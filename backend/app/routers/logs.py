from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_caregiver
from app.database import get_db
from app.deps import get_the_elder
from app.models import Caregiver, ConversationTurn, Elder, Medication, ReminderEvent
from app.schemas import ConversationTurnOut, ReminderEventOut

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/adherence", response_model=list[ReminderEventOut])
def adherence_log(
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> list[ReminderEventOut]:
    rows = db.execute(
        select(ReminderEvent, Medication)
        .join(Medication, ReminderEvent.medication_id == Medication.id)
        .where(ReminderEvent.elder_id == elder.id)
        .order_by(ReminderEvent.scheduled_for.desc())
        .limit(100)
    ).all()

    return [
        ReminderEventOut(
            id=event.id,
            medication_id=event.medication_id,
            medication_name=med.name,
            scheduled_for=event.scheduled_for,
            status=event.status,
            delivered_at=event.delivered_at,
            responded_at=event.responded_at,
        )
        for event, med in rows
    ]


@router.get("/conversation", response_model=list[ConversationTurnOut])
def conversation_log(
    db: Session = Depends(get_db),
    elder: Elder = Depends(get_the_elder),
    caregiver: Caregiver = Depends(get_current_caregiver),
) -> list[ConversationTurn]:
    return db.execute(
        select(ConversationTurn)
        .where(ConversationTurn.elder_id == elder.id)
        .order_by(ConversationTurn.created_at.desc())
        .limit(100)
    ).scalars().all()
