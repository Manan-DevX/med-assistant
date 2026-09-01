"""Wraps the Google Gemini API for the two things ElderCompanion needs:

1. understand_and_reply — take a recorded audio clip of the elder speaking and, in one call,
   get back both a transcript (for logs) and a warm in-character reply (for TTS + display).
2. synthesize_speech — turn reply text into playable WAV audio.

Model IDs are read from settings/.env rather than hardcoded, since Google renames/retires
preview models fairly often — if a call starts failing with a "model not found" error, update
GEMINI_TEXT_MODEL / GEMINI_TTS_MODEL in backend/.env to whatever ai.google.dev/gemini-api/docs/models
currently lists.
"""

import base64
import datetime
import io
import wave

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import settings

_client: genai.Client | None = None

PERSONA_INSTRUCTION = (
    "You are ElderCompanion, a warm, patient, friendly voice companion living inside a small "
    "home robot for a senior. Speak in short, simple, natural sentences — the way a caring "
    "companion would, not a customer support bot. Never use markdown, bullet points, or emoji. "
    "You help with medication reminders, friendly conversation, and relaying messages from "
    "family. If the person sounds confused, distressed, or mentions a medical emergency, gently "
    "suggest they contact family or emergency services. Keep replies to 1-3 sentences unless "
    "the person is clearly asking for something longer.\n\n"
    "You will be given a block of grounding facts (current date/time, the elder's medication "
    "schedule) before each message — those are the only source of truth for anything factual. "
    "If asked about the time, date, or medications, answer strictly from those facts. For "
    "anything else you don't actually know (news, other people's plans, medical advice), say so "
    "plainly and suggest checking with family or a doctor — never invent a plausible-sounding "
    "answer."
)


class MedicationInfo(BaseModel):
    name: str
    dosage: str
    schedule_times: list[str]


class ConverseResult(BaseModel):
    heard_speech: bool
    transcript: str
    reply_text: str


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Copy backend/.env.example to backend/.env and add "
                "a key from https://aistudio.google.com/apikey"
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _grounding_block(elder_name: str, medications: list[MedicationInfo]) -> str:
    now = datetime.datetime.now()
    lines = [f"Current date & time: {now.strftime('%A, %B %d, %Y, %I:%M %p')}", ""]
    if medications:
        lines.append(f"{elder_name}'s medications:")
        for med in medications:
            dosage_part = f" ({med.dosage})" if med.dosage else ""
            times_part = ", ".join(med.schedule_times) if med.schedule_times else "no scheduled time"
            lines.append(f"- {med.name}{dosage_part} — scheduled at {times_part}")
    else:
        lines.append(f"{elder_name} has no medications currently scheduled.")
    return "\n".join(lines)


def understand_and_reply(
    audio_bytes: bytes,
    mime_type: str,
    history: list[tuple[str, str]],
    elder_name: str,
    medications: list[MedicationInfo],
) -> ConverseResult:
    """history is a list of (role, text) tuples, oldest first, role is 'user' or 'assistant'."""
    client = _get_client()

    history_text = "\n".join(f"{role}: {text}" for role, text in history[-10:]) or "(no prior turns)"
    grounding = _grounding_block(elder_name, medications)

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text=(
                        f"Grounding facts:\n{grounding}\n\n"
                        "Recent conversation history for context:\n"
                        f"{history_text}\n\n"
                        "Now listen closely to the attached audio clip. Transcribe ONLY what is "
                        "actually, audibly said in THIS clip — never use the conversation history "
                        "or your companion persona to guess, complete, or invent plausible-sounding "
                        "speech. If the clip is silent, too short, just noise/breathing/a click, or "
                        "genuinely unintelligible, that is a normal and expected result: set "
                        '"heard_speech" to false, "transcript" to an empty string, and "reply_text" '
                        "to a brief, in-character line asking them to try again (e.g. \"I didn't "
                        'quite catch that — could you say it again?"). Do NOT fabricate a transcript '
                        "in this case, even if a plausible one would fit an elderly speaker's "
                        "situation. Only when you are confident you can make out real speech should "
                        'you set "heard_speech" to true and reply normally in character, using the '
                        "grounding facts above for anything factual. Respond with JSON containing:\n"
                        '  "heard_speech": boolean, per the rule above\n'
                        '  "transcript": faithful verbatim transcription of exactly what was said, '
                        'or "" if heard_speech is false\n'
                        '  "reply_text": your in-character spoken reply, following your persona '
                        "instructions"
                    )
                ),
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            ],
        )
    ]

    response = client.models.generate_content(
        model=settings.gemini_text_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=PERSONA_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=ConverseResult,
        ),
    )

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, ConverseResult):
        return parsed
    try:
        return ConverseResult.model_validate_json(response.text or "")
    except (ValidationError, TypeError) as exc:
        # Safety blocks and truncated generations come back without usable JSON. Fail as a
        # normal "didn't catch that" turn rather than a 500 in the elder's face.
        raise RuntimeError(
            "Gemini returned no usable response for that clip — it may have been blocked or "
            f"empty. Try again. ({exc.__class__.__name__})"
        ) from exc


def synthesize_speech(text: str) -> bytes:
    """Returns playable WAV bytes (16-bit PCM, mono, 24kHz per Gemini TTS output spec)."""
    client = _get_client()

    response = client.models.generate_content(
        model=settings.gemini_tts_model,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=settings.gemini_tts_voice
                    )
                )
            ),
        ),
    )

    pcm_bytes = None
    for candidate in response.candidates or []:
        for part in (candidate.content.parts if candidate.content else None) or []:
            if part.inline_data is not None and part.inline_data.data:
                pcm_bytes = part.inline_data.data
                break
        if pcm_bytes is not None:
            break

    if pcm_bytes is None:
        # Safety-blocked or empty TTS responses carry no audio part at all.
        raise RuntimeError("Gemini returned no audio for that text — it may have been blocked.")

    if isinstance(pcm_bytes, str):
        pcm_bytes = base64.b64decode(pcm_bytes)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(24000)
        wf.writeframes(pcm_bytes)
    return buffer.getvalue()
