import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.models import Caregiver, Elder, Medication


def run_seed(db: Session) -> None:
    caregiver = db.execute(
        select(Caregiver).where(Caregiver.email == settings.demo_caregiver_email)
    ).scalars().first()
    if caregiver is None:
        db.add(
            Caregiver(
                email=settings.demo_caregiver_email,
                password_hash=hash_password(settings.demo_caregiver_password),
                name=settings.demo_caregiver_name,
            )
        )

    elder = db.execute(select(Elder)).scalars().first()
    if elder is None:
        elder = Elder(name=settings.demo_elder_name)
        db.add(elder)
        db.commit()
        db.refresh(elder)

        soon = (datetime.datetime.now() + datetime.timedelta(minutes=2)).strftime("%H:%M")
        db.add_all(
            [
                Medication(
                    elder_id=elder.id,
                    name="Metformin",
                    dosage="500mg, with food",
                    schedule_times=["08:00", "20:00"],
                    active=True,
                ),
                Medication(
                    elder_id=elder.id,
                    name="Lisinopril",
                    dosage="10mg",
                    schedule_times=["09:00"],
                    active=True,
                ),
                Medication(
                    elder_id=elder.id,
                    name="Vitamin D",
                    dosage="1 tablet",
                    schedule_times=[soon],
                    active=True,
                ),
            ]
        )

    db.commit()
