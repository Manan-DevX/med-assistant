# ElderCompanion — software MVP

A locally-runnable proof of concept for **ElderCompanion**: a physically embodied AI companion
robot for seniors that (1) speaks medication/event reminders, (2) has natural conversation, and
(3) relays family messages while logging adherence for caregivers. The full concept and research
background lives in [`.txt`](./.txt).

There's no robot hardware yet (no Pi, no ReSpeaker mic array, no speaker), so this MVP simulates
the device entirely in the browser: your laptop's mic and speaker stand in for the robot's, and a
CSS "orb" stands in for its LED indicators. Everything else — the reminder scheduler, the Gemini
conversation loop, the family messaging, the adherence logging — is the real backend logic the
robot would eventually run.

## Architecture

```
                        ┌─────────────────────┐
                        │   Google Gemini API   │
                        │  (dialogue + speech)   │
                        └──────────▲─────────────┘
                                   │
┌────────────────────┐   HTTP/WS  │        ┌──────────────────────┐
│  frontend (Next.js) │◄──────────┴───────►│  backend (FastAPI)     │
│                      │                    │                        │
│  /companion  ── robot simulator           │  reminders scheduler   │
│    (mic, speaker,     ◄── WebSocket ──────┤  (APScheduler)         │
│     orb, live push)                       │  SQLite (SQLAlchemy)   │
│  /login, /dashboard ── caregiver portal   │  JWT auth (caregiver)  │
│    (meds, messages,   ── REST ───────────►│                        │
│     adherence & chat logs)                └──────────────────────┘
└────────────────────┘
```

- **backend/** — FastAPI service: medication scheduling, Gemini-powered conversation (speech in,
  speech out), family messaging, adherence + conversation logs, a WebSocket that pushes reminders
  and messages to the companion client in real time. See [`backend/README.md`](backend/README.md)
  for setup and how to exercise it standalone via curl (no frontend needed).
- **frontend/** — Next.js + Tailwind app with two experiences: `/companion` (the robot simulator,
  no login — a home device wouldn't have one) and `/login` + `/dashboard` (the family/caregiver
  portal, JWT-protected).

## What's simulated vs. real

| Proposal (with hardware)                  | This MVP                                              |
| ------------------------------------------ | ------------------------------------------------------ |
| ReSpeaker mic array + wake word (Porcupine)| Browser mic + a "hold to talk" button                  |
| 3–5W speaker                                | Browser `<audio>` playback of Gemini-generated speech   |
| LED listening/speaking indicators           | Animated on-screen orb (idle/listening/thinking/speaking)|
| Raspberry Pi on-device runtime              | Runs as an ordinary local web app                       |
| Everything else (reminders, dialogue, family telepresence, adherence logging, auth) | Real — same logic the robot would run |

## Setup

You need Node 20+, Python 3.11+, and a free [Gemini API key](https://aistudio.google.com/apikey).

```powershell
# Backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# edit .env and paste your GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

```powershell
# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Demo script

1. Go to **`/dashboard`**, log in with the pre-seeded demo caregiver (`demo@eldercompanion.ai` /
   `demo1234`, shown on the login screen).
2. **Medications tab** — click "Trigger now" on one of the seeded medications (or add your own).
3. Open **`/companion`** in another tab — within a second or two, the reminder banner appears and
   the orb speaks it aloud. Click "I took it".
4. Back in the dashboard's **Logs tab**, see the adherence entry recorded as confirmed.
5. **Family messages tab** — send a text message ("Hi Mom, thinking of you!"). Switch to the
   companion tab: it's spoken aloud and shown as a card from the sender.
6. On the companion page, hold **"Hold to talk"**, say something, release — Gemini transcribes it,
   replies in character, and speaks the reply back. The exchange also shows up in the dashboard's
   **conversation transcript**.
7. One of the seeded medications ("Vitamin D") is scheduled ~2 minutes after the backend starts —
   leave it running and it fires on its own, no button needed, to show the real scheduler working.
8. Reminders survive a closed tab: trigger one with `/companion` closed, then open it — the
   banner is still waiting, recovered from the database rather than the missed live push.

Reminders move through `delivered → confirmed / snoozed / missed`. "Snooze" genuinely re-fires
after 10 minutes, and an unanswered reminder is logged as **missed** after 15 minutes — set
`REMINDER_MISSED_AFTER_MINUTES=1` in `backend/.env` to show that during a short demo.

## Repo layout

```
Nurse.ai/
  .txt              original ElderCompanion project proposal
  backend/           FastAPI service — see backend/README.md
  frontend/          Next.js + Tailwind app
```
