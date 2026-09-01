import Link from "next/link";
import { HeartHandshake, LayoutDashboard, Radio } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-accent">
          <HeartHandshake className="h-7 w-7" />
          <span className="text-sm font-semibold uppercase tracking-widest">ElderCompanion</span>
        </div>
        <h1 className="max-w-2xl font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          A software MVP of an embodied AI companion for seniors
        </h1>
        <p className="max-w-xl text-ink-muted">
          No hardware yet — this browser tab stands in for the robot&rsquo;s mic, speaker, and
          LEDs. Pick a view below to start the demo.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <Link
          href="/companion"
          className="group flex flex-col gap-4 rounded-3xl border border-line bg-surface p-8 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
        >
          <Radio className="h-9 w-9 text-accent" />
          <div>
            <h2 className="text-xl font-semibold text-ink">Companion</h2>
            <p className="mt-1 text-sm text-ink-muted">
              The robot simulator — hears reminders and family messages, and lets you talk to it
              via your laptop mic.
            </p>
          </div>
          <span className="mt-auto text-sm font-medium text-accent group-hover:underline">
            Open companion view →
          </span>
        </Link>

        <Link
          href="/login"
          className="group flex flex-col gap-4 rounded-3xl border border-line bg-surface p-8 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
        >
          <LayoutDashboard className="h-9 w-9 text-accent" />
          <div>
            <h2 className="text-xl font-semibold text-ink">Family dashboard</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Caregiver login — manage medications, send messages, and review adherence &amp;
              conversation logs.
            </p>
          </div>
          <span className="mt-auto text-sm font-medium text-accent group-hover:underline">
            Open dashboard →
          </span>
        </Link>
      </div>
    </main>
  );
}
