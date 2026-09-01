import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import ConversationRole, MessageKind, ReminderStatus


def _normalize_times(times: list[str]) -> list[str]:
    """The scheduler matches schedule times against strftime("%H:%M"), so "8:00" would never
    fire. Normalize to zero-padded 24h and reject anything that isn't a real time."""
    normalized = []
    for raw in times:
        value = raw.strip()
        try:
            parsed = datetime.datetime.strptime(value, "%H:%M")
        except ValueError:
            raise ValueError(f"'{raw}' is not a valid 24-hour time — use HH:MM, e.g. 08:00")
        normalized.append(parsed.strftime("%H:%M"))
    return normalized


class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=200)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    caregiver_name: str
    elder_id: int
    elder_name: str


class MedicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    dosage: str = Field(default="", max_length=255)
    schedule_times: list[str] = []
    active: bool = True

    @field_validator("schedule_times")
    @classmethod
    def check_times(cls, times: list[str]) -> list[str]:
        return _normalize_times(times)


class MedicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    dosage: str | None = Field(default=None, max_length=255)
    schedule_times: list[str] | None = None
    active: bool | None = None

    @field_validator("schedule_times")
    @classmethod
    def check_times(cls, times: list[str] | None) -> list[str] | None:
        return None if times is None else _normalize_times(times)


class MedicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    name: str
    dosage: str
    schedule_times: list[str]
    active: bool


class ReminderEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication_id: int
    medication_name: str
    scheduled_for: datetime.datetime
    status: ReminderStatus
    delivered_at: datetime.datetime | None
    responded_at: datetime.datetime | None


class MessageCreate(BaseModel):
    sender_name: str
    kind: MessageKind = MessageKind.text
    content_text: str = ""


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    sender_name: str
    kind: MessageKind
    content_text: str
    audio_url: str | None
    created_at: datetime.datetime
    played_at: datetime.datetime | None


class ConversationTurnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ConversationRole
    content_text: str
    created_at: datetime.datetime


class ConverseResponse(BaseModel):
    transcript: str
    reply_text: str
    reply_audio_base64: str


class TTSPreviewRequest(BaseModel):
    text: str
