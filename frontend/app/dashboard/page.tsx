"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, LogOut, Radio } from "lucide-react";
import Link from "next/link";
import { clearToken, getToken } from "@/lib/api";
import { MedicationsPanel } from "@/components/MedicationsPanel";
import { MessagesPanel } from "@/components/MessagesPanel";
import { LogsPanel } from "@/components/LogsPanel";

type Tab = "medications" | "messages" | "logs";

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("medications");
  const [caregiverName, setCaregiverName] = useState("");
  const [elderName, setElderName] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setCaregiverName(window.localStorage.getItem("ec_caregiver_name") ?? "");
    setElderName(window.localStorage.getItem("ec_elder_name") ?? "");
    setReady(true);
  }, [router]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  if (!ready) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "medications", label: "Medications" },
    { key: "messages", label: "Family messages" },
    { key: "logs", label: "Logs" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink">
          <HeartHandshake className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-serif text-lg font-medium">ElderCompanion — Family dashboard</h1>
            <p className="text-xs text-ink-muted">
              {caregiverName ? `${caregiverName} · ` : ""}Caring for {elderName || "your family member"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/companion"
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
          >
            <Radio className="h-3.5 w-3.5" /> Companion view
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-cream-soft"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-b-2 border-accent text-ink"
                : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "medications" && <MedicationsPanel />}
      {tab === "messages" && <MessagesPanel />}
      {tab === "logs" && <LogsPanel />}
    </main>
  );
}
