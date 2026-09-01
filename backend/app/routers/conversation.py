import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_the_elder
from app.models import ConversationRole, ConversationTurn, Elder, Medication
from app.schemas import ConverseResponse
from app.services.gemini_service import MedicationInfo, synthesize_speech, understand_and_reply

router = APIRouter(prefix="/api/converse", tags=["conversation"])

MAX_CLIP_BYTES = 10 * 1024 * 1024


@router.post("", response_model=ConverseResponse)
async def converse(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
) -> ConverseResponse:
    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio clip")
    if len(audio_bytes) > MAX_CLIP_BYTES:
        raise HTTPException(
            status_code=400, detail=f"Clip is limited to {MAX_CLIP_BYTES // (1024 * 1024)}MB"
        )

    history_rows = (
        db.execute(
            select(ConversationTurn)
            .where(ConversationTurn.elder_id == elder.id)
            .order_by(ConversationTurn.created_at.desc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    history = [(row.role.value, row.content_text) for row in reversed(history_rows)]

    med_rows = (
        db.execute(select(Medication).where(Medication.elder_id == elder.id, Medication.active.is_(True)))
        .scalars()
        .all()
    )
    medications = [
        MedicationInfo(name=m.name, dosage=m.dosage, schedule_times=m.schedule_times) for m in med_rows
    ]

    # Both Gemini calls are blocking network round-trips; off the event loop they'd stall
    # every other request, including the scheduler's reminder pushes over the WebSocket.
    result = await run_in_threadpool(
        understand_and_reply, audio_bytes, mime_type, history, elder.name, medications
    )

    if result.heard_speech:
        db.add(
            ConversationTurn(
                elder_id=elder.id, role=ConversationRole.user, content_text=result.transcript
            )
        )
    db.add(
        ConversationTurn(
            elder_id=elder.id, role=ConversationRole.assistant, content_text=result.reply_text
        )
    )
    db.commit()

    reply_audio = await run_in_threadpool(synthesize_speech, result.reply_text)

    return ConverseResponse(
        transcript=result.transcript,
        reply_text=result.reply_text,
        reply_audio_base64=base64.b64encode(reply_audio).decode("utf-8"),
    )
