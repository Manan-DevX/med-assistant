# ElderCompanion backend

FastAPI service that stands in for the robot's on-device + cloud brain: medication/event
reminders, Gemini-powered conversation (speech-in, speech-out), family messaging, and adherence
logging. Runs entirely locally — no hardware or hosting required.

## Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY` (get one free at https://aistudio.google.com/apikey). Every
other setting has a working default.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

On first run this creates `eldercompanion.db` (SQLite) and seeds:
- a demo caregiver login (`DEMO_CAREGIVER_EMAIL` / `DEMO_CAREGIVER_PASSWORD` in `.env`, default
  `demo@eldercompanion.ai` / `demo1234`)
- one demo elder ("Grandma Rose")
- three medications, one of which is scheduled ~2 minutes after the backend first starts, so you
  can watch a reminder fire live without waiting or clicking anything.

Interactive API docs: http://localhost:8000/docs

## Demoing the backend alone (no frontend needed)

```powershell
# 1. Log in
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" `
  -d '{"email":"demo@eldercompanion.ai","password":"demo1234"}'
# -> copy the access_token from the response

$TOKEN = "<paste token here>"

# 2. List medications
curl http://localhost:8000/api/reminders/medications -H "Authorization: Bearer $TOKEN"

# 3. Fire a reminder immediately instead of waiting for its scheduled time
curl -X POST http://localhost:8000/api/reminders/medications/1/trigger-now -H "Authorization: Bearer $TOKEN"

# 4. Get the spoken audio for that reminder event (id from step 3's response)
curl http://localhost:8000/api/reminders/events/1/audio
# -> { "text": "...", "audio_base64": "..." } — the base64 is a playable WAV file

# 5. Have a spoken "conversation" — record a short WAV/webm clip of yourself talking, then:
curl -X POST http://localhost:8000/api/converse -H "Authorization: Bearer $TOKEN" `
  -F "audio=@my_clip.wav;type=audio/wav"
# -> { "transcript": "...", "reply_text": "...", "reply_audio_base64": "..." }

# 6. Send a family message
curl -X POST http://localhost:8000/api/messages -H "Authorization: Bearer $TOKEN" `
  -F "sender_name=Daughter Mira" -F "content_text=Hi mom, thinking of you!"

# 7. Check logs
curl http://localhost:8000/api/logs/adherence -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/logs/conversation -H "Authorization: Bearer $TOKEN"
```

Reminders and family messages also broadcast over `ws://localhost:8000/ws/companion` — that's
what the companion frontend listens on to react in real time; you can also watch it fire with
any WebSocket test client.

A WebSocket push only reaches whoever is connected at that moment, so the companion also fetches
anything it missed on load:

```powershell
curl http://localhost:8000/api/reminders/events/pending   # delivered, not yet answered
curl http://localhost:8000/api/messages/unplayed          # sent, not yet heard
```

## Reminder lifecycle

`delivered` → `confirmed` (elder tapped "I took it") or `snoozed` (re-delivered after
`SNOOZE_MINUTES`) or `missed` (no response within `REMINDER_MISSED_AFTER_MINUTES`, set by a
background sweep). Set `REMINDER_MISSED_AFTER_MINUTES=1` in `.env` if you want to demo a missed
dose without waiting.

## Notes

- All timestamps are stored as **naive local time**. SQLite's SQLAlchemy dialect ignores
  `tzinfo`, so storing UTC-aware values would persist UTC wall-clock numbers with no offset
  marker, which the scheduler's `HH:MM` matching and the frontend's `new Date(...)` would both
  then misread as local. See `models.now_local`.
- Auth is intentionally minimal (single seeded caregiver, JWT bearer tokens) — enough to
  demonstrate "caregiver accounts need to log in", not production-grade multi-tenant auth.
- `/api/converse`, `/api/reminders/events/*`, `/api/messages/*/played|unplayed` are
  unauthenticated on purpose — they're called by the companion device itself, which in the real
  product has no login (a home appliance, not a caregiver). Anything reachable on the network
  can therefore answer a reminder; a real deployment would give the device its own credential.
- Endpoints scope lookups to the seeded elder, so id-guessing can't reach another elder's data
  once more than one exists.
- If Gemini calls start failing with a "model not found" style error, Google has likely renamed
  or retired a preview model — check https://ai.google.dev/gemini-api/docs/models and update
  `GEMINI_TEXT_MODEL` / `GEMINI_TTS_MODEL` in `.env`.
