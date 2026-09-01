import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Medication, ReminderEvent, ReminderStatus, now_local
from app.services.ws_manager import manager

_scheduler = BackgroundScheduler()


def _check_due_medications() -> None:
    now = now_local()
    hhmm = now.strftime("%H:%M")
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    db = SessionLocal()
    try:
        meds = db.execute(select(Medication).where(Medication.active.is_(True))).scalars().all()
        for med in meds:
            if hhmm not in (med.schedule_times or []):
                continue

            # Already delivered this medication for this clock slot today? Timestamps are naive
            # local (see models.now_local), so these comparisons stay in one time base.
            delivered_today = db.execute(
                select(ReminderEvent).where(
                    ReminderEvent.medication_id == med.id,
                    ReminderEvent.scheduled_for >= today_start,
                )
            ).scalars().all()
            if any(ev.scheduled_for.strftime("%H:%M") == hhmm for ev in delivered_today):
                continue

            deliver_reminder(db, med)

        _sweep_missed(db, now)
    finally:
        db.close()


def _sweep_missed(db, now: datetime.datetime) -> None:
    """A delivered reminder the elder never confirmed or snoozed becomes 'missed', so the
    adherence log distinguishes 'no response' from 'still waiting'."""
    cutoff = now - datetime.timedelta(minutes=settings.reminder_missed_after_minutes)
    stale = db.execute(
        select(ReminderEvent).where(
            ReminderEvent.status == ReminderStatus.delivered,
            ReminderEvent.responded_at.is_(None),
            ReminderEvent.delivered_at < cutoff,
        )
    ).scalars().all()
    if not stale:
        return
    for event in stale:
        event.status = ReminderStatus.missed
    db.commit()


def deliver_reminder(db, medication: Medication) -> ReminderEvent:
    now = now_local()
    event = ReminderEvent(
        medication_id=medication.id,
        elder_id=medication.elder_id,
        scheduled_for=now,
        status=ReminderStatus.delivered,
        delivered_at=now,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    manager.broadcast_threadsafe(
        {
            "type": "reminder_due",
            "event_id": event.id,
            "medication_id": medication.id,
            "medication_name": medication.name,
            "dosage": medication.dosage,
        }
    )
    return event


def _redeliver_snoozed(medication_id: int) -> None:
    db = SessionLocal()
    try:
        med = db.get(Medication, medication_id)
        if med is not None and med.active:
            deliver_reminder(db, med)
    finally:
        db.close()


def schedule_snooze(medication_id: int) -> None:
    """Re-deliver a snoozed reminder after the snooze window — otherwise 'Snooze' would just be
    a dismiss button."""
    run_at = now_local() + datetime.timedelta(minutes=settings.snooze_minutes)
    _scheduler.add_job(
        _redeliver_snoozed,
        "date",
        run_date=run_at,
        args=[medication_id],
        id=f"snooze_med_{medication_id}_{run_at.timestamp()}",
        replace_existing=True,
    )


def start_scheduler() -> None:
    if not _scheduler.running:
        _scheduler.add_job(_check_due_medications, "interval", seconds=20, id="check_due_meds")
        _scheduler.start()


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
