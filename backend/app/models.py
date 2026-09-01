import datetime
import enum

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def now_local() -> datetime.datetime:
    """Naive local time.

    SQLite's SQLAlchemy dialect formats datetimes from their raw .year/.hour/... fields and
    ignores tzinfo entirely, so storing UTC-aware values silently persists UTC wall-clock
    numbers with no offset marker. Everything else here — the scheduler's "HH:MM" matching,
    and the frontend's `new Date(...)` parsing of offset-less strings — reads those numbers as
    local time. Storing naive local time keeps all three consistent.
    """
    return datetime.datetime.now()


class Caregiver(Base):
    __tablename__ = "caregivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=now_local)


class Elder(Base):
    __tablename__ = "elders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=now_local)

    medications: Mapped[list["Medication"]] = relationship(back_populates="elder")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"))
    name: Mapped[str] = mapped_column(String(255))
    dosage: Mapped[str] = mapped_column(String(255), default="")
    schedule_times: Mapped[list[str]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=now_local)

    elder: Mapped["Elder"] = relationship(back_populates="medications")


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    confirmed = "confirmed"
    snoozed = "snoozed"
    missed = "missed"


class ReminderEvent(Base):
    __tablename__ = "reminder_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id"))
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"))
    scheduled_for: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[ReminderStatus] = mapped_column(
        Enum(ReminderStatus), default=ReminderStatus.pending
    )
    delivered_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    responded_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    medication: Mapped["Medication"] = relationship()


class MessageKind(str, enum.Enum):
    text = "text"
    audio = "audio"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"))
    sender_name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[MessageKind] = mapped_column(Enum(MessageKind), default=MessageKind.text)
    content_text: Mapped[str] = mapped_column(Text, default="")
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=now_local)
    played_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ConversationRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id: Mapped[int] = mapped_column(primary_key=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"))
    role: Mapped[ConversationRole] = mapped_column(Enum(ConversationRole))
    content_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=now_local)
