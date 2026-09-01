# ElderCompanion frontend

Next.js + Tailwind app with two experiences — see the [root README](../README.md) for the full
architecture and demo script.

- **`/companion`** — the robot simulator (no login). Uses the browser mic/speaker to stand in for
  the physical device's ReSpeaker array and speaker.
- **`/login` + `/dashboard`** — the family/caregiver portal: manage medications, send messages,
  review adherence and conversation logs.

## Run

```powershell
npm install
npm run dev
```

Requires the backend running at the URL in `.env.local` (`NEXT_PUBLIC_API_URL`, default
`http://localhost:8000`) — see [`../backend/README.md`](../backend/README.md).
