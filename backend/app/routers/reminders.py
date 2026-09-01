import base64

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_caregiver
from app.database import get_db
from app.deps import get_owned_or_404, get_the_elder
from app.models import Caregiver, Elder, Medication, ReminderEvent, ReminderStatus, now_local
from app.schemas import MedicationCreate, MedicationOut, MedicationUpdate, ReminderEventOut
from app.services.gemini_service import synthesize_speech
from app.services.scheduler import deliver_reminder, schedule_snooze

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _to_event_out(event: ReminderEvent, medication: Medication) -> ReminderEventOut:
    return ReminderEventOut(
        id=event.id,
        medication_id=medication.id,
        medication_name=medication.name,
        scheduled_for=event.scheduled_for,
        status=event.status,
        delivered_at=event.delivered_at,
        responded_at=event.responded_at,
    )


@router.get("/medications", response_model=list[MedicationOut])
def list_medications(
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> list[Medication]:
    return db.execute(
        select(Medication).where(Medication.elder_id == elder.id).order_by(Medication.id)
    ).scalars().all()


@router.post("/medications", response_model=MedicationOut)
def create_medication(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> Medication:
    med = Medication(elder_id=elder.id, **payload.model_dump())
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.patch("/medications/{medication_id}", response_model=MedicationOut)
def update_medication(
    medication_id: int,
    payload: MedicationUpdate,
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> Medication:
    med = get_owned_or_404(db, Medication, medication_id, elder.id, "Medication not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(med, field, value)
    db.commit()
    db.refresh(med)
    return med


@router.delete("/medications/{medication_id}")
def delete_medication(
    medication_id: int,
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> dict:
    med = get_owned_or_404(db, Medication, medication_id, elder.id, "Medication not found")
    # Reminder events reference this medication for their name/dosage text, so they go with it
    # rather than being left dangling.
    for event in db.execute(
        select(ReminderEvent).where(ReminderEvent.medication_id == med.id)
    ).scalars().all():
        db.delete(event)
    db.delete(med)
    db.commit()
    return {"ok": True}


@router.post("/medications/{medication_id}/trigger-now", response_model=ReminderEventOut)
def trigger_now(
    medication_id: int,
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> ReminderEventOut:
    """Demo aid — fires a reminder immediately instead of waiting for its scheduled time."""
    med = get_owned_or_404(db, Medication, medication_id, elder.id, "Medication not found")
    event = deliver_reminder(db, med)
    return _to_event_out(event, med)


@router.get("/events/pending", response_model=list[ReminderEventOut])
def pending_events(
    db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> list[ReminderEventOut]:
    """Reminders already delivered but not yet answered.

    The companion fetches these on load so a reminder that fired while no companion was
    connected (or before the page opened) still gets shown, instead of being lost with the
    WebSocket push.
    """
    rows = db.execute(
        select(ReminderEvent, Medication)
        .join(Medication, ReminderEvent.medication_id == Medication.id)
        .where(
            ReminderEvent.elder_id == elder.id,
            ReminderEvent.status == ReminderStatus.delivered,
            ReminderEvent.responded_at.is_(None),
        )
        .order_by(ReminderEvent.scheduled_for)
    ).all()
    return [_to_event_out(event, med) for event, med in rows]


@router.post("/events/{event_id}/confirm")
def confirm_event(
    event_id: int, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> dict:
    event = get_owned_or_404(db, ReminderEvent, event_id, elder.id, "Reminder event not found")
    event.status = ReminderStatus.confirmed
    event.responded_at = now_local()
    db.commit()
    return {"ok": True}


@router.post("/events/{event_id}/snooze")
def snooze_event(
    event_id: int, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> dict:
    event = get_owned_or_404(db, ReminderEvent, event_id, elder.id, "Reminder event not found")
    event.status = ReminderStatus.snoozed
    event.responded_at = now_local()
    db.commit()
    schedule_snooze(event.medication_id)
    return {"ok": True}


@router.get("/events/{event_id}/audio")
def event_audio(
    event_id: int, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> dict:
    """Called by the companion client to fetch the spoken reminder line."""
    event = get_owned_or_404(db, ReminderEvent, event_id, elder.id, "Reminder event not found")
    med = get_owned_or_404(db, Medication, event.medication_id, elder.id, "Medication not found")
    dosage_phrase = f", {med.dosage}" if med.dosage else ""
    text = f"It's time to take your {med.name}{dosage_phrase}."
    audio = synthesize_speech(text)
    return {"text": text, "audio_base64": base64.b64encode(audio).decode("utf-8")}
