import base64
import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_caregiver
from app.config import settings
from app.database import get_db
from app.deps import get_owned_or_404, get_the_elder
from app.models import Caregiver, Elder, Message, MessageKind, now_local
from app.schemas import MessageOut
from app.services.gemini_service import synthesize_speech
from app.services.ws_manager import manager

router = APIRouter(prefix="/api/messages", tags=["messages"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 2000


def _to_out(msg: Message) -> MessageOut:
    return MessageOut(
        id=msg.id,
        elder_id=msg.elder_id,
        sender_name=msg.sender_name,
        kind=msg.kind,
        content_text=msg.content_text,
        audio_url=f"/media/{msg.audio_path}" if msg.audio_path else None,
        created_at=msg.created_at,
        played_at=msg.played_at,
    )


@router.get("", response_model=list[MessageOut])
def list_messages(
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> list[MessageOut]:
    rows = db.execute(
        select(Message).where(Message.elder_id == elder.id).order_by(Message.created_at.desc())
    ).scalars().all()
    return [_to_out(m) for m in rows]


@router.post("", response_model=MessageOut)
async def send_message(
    sender_name: str = Form(...),
    content_text: str = Form(""),
    audio: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> MessageOut:
    audio_path = None
    kind = MessageKind.text

    if len(content_text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400, detail=f"Message text is limited to {MAX_TEXT_CHARS} characters"
        )

    if audio is not None:
        kind = MessageKind.audio
        data = await audio.read()
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Voice note is limited to {MAX_AUDIO_BYTES // (1024 * 1024)}MB",
            )
        # Keep only a safe extension from the client-supplied name — anything with a path
        # separator in it would otherwise be spliced into the destination path.
        raw_ext = (audio.filename or "clip.webm").rsplit(".", 1)[-1]
        ext = raw_ext if re.fullmatch(r"[A-Za-z0-9]{1,8}", raw_ext) else "webm"
        filename = f"{uuid.uuid4().hex}.{ext}"
        dest = settings.audio_upload_dir / filename
        dest.write_bytes(data)
        audio_path = filename

    if kind == MessageKind.text and not content_text.strip():
        raise HTTPException(status_code=400, detail="content_text is required for text messages")

    msg = Message(
        elder_id=elder.id,
        sender_name=sender_name,
        kind=kind,
        content_text=content_text,
        audio_path=audio_path,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    await manager.broadcast(
        {
            "type": "family_message",
            "message_id": msg.id,
            "sender_name": msg.sender_name,
            "kind": msg.kind.value,
            "content_text": msg.content_text,
            "audio_url": f"/media/{msg.audio_path}" if msg.audio_path else None,
        }
    )

    return _to_out(msg)


@router.get("/unplayed", response_model=list[MessageOut])
def unplayed_messages(
    db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> list[MessageOut]:
    """Messages the companion hasn't played yet — fetched on load so one sent while no
    companion was connected still gets heard rather than lost with the WebSocket push."""
    rows = db.execute(
        select(Message)
        .where(Message.elder_id == elder.id, Message.played_at.is_(None))
        .order_by(Message.created_at)
    ).scalars().all()
    return [_to_out(m) for m in rows]


@router.post("/{message_id}/played")
def mark_played(
    message_id: int, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> dict:
    msg = get_owned_or_404(db, Message, message_id, elder.id, "Message not found")
    msg.played_at = now_local()
    db.commit()
    return {"ok": True}


@router.get("/{message_id}/audio")
def message_audio(
    message_id: int, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> dict:
    """For text messages only — synthesizes speech on demand so the companion can speak it."""
    msg = get_owned_or_404(db, Message, message_id, elder.id, "Message not found")
    if msg.kind != MessageKind.text:
        raise HTTPException(status_code=400, detail="Message is already audio; use audio_url")
    audio = synthesize_speech(msg.content_text)
    return {"text": msg.content_text, "audio_base64": base64.b64encode(audio).decode("utf-8")}
