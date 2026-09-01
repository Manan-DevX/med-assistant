"use client";

import { useEffect, useState } from "react";
import { PlayCircle, Plus, Power, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Medication } from "@/lib/types";

export function MedicationsPanel() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Medication[]>("/api/reminders/medications");
      setMeds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load medications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMedication(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const schedule_times = times
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await apiFetch("/api/reminders/medications", {
        method: "POST",
        body: { name, dosage, schedule_times, active: true },
      });
      setName("");
      setDosage("");
      setTimes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add medication");
    }
  }

  async function triggerNow(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/reminders/medications/${id}/trigger-now`, { method: "POST" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger reminder");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(med: Medication) {
    setBusyId(med.id);
    setError(null);
    try {
      await apiFetch(`/api/reminders/medications/${med.id}`, {
        method: "PATCH",
        body: { active: !med.active },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update medication");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/reminders/medications/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete medication");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={addMedication}
        className="grid grid-cols-1 gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:grid-cols-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Medication name"
          required
          className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="Dosage (e.g. 500mg)"
          className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          value={times}
          onChange={(e) => setTimes(e.target.value)}
          placeholder="Times, e.g. 08:00, 20:00"
          className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : meds.length === 0 ? (
        <p className="text-sm text-ink-faint">No medications yet — add one above.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {meds.map((med) => (
            <div
              key={med.id}
              className={`rounded-3xl border p-4 shadow-sm ${
                med.active ? "border-line bg-surface" : "border-line-soft bg-cream-soft opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{med.name}</p>
                  {med.dosage && <p className="text-xs text-ink-muted">{med.dosage}</p>}
                </div>
                <span className="rounded-full bg-cream-soft px-2 py-0.5 text-[11px] text-ink-muted">
                  {med.active ? "active" : "inactive"}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                {med.schedule_times.length > 0 ? med.schedule_times.join(", ") : "No schedule set"}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => triggerNow(med.id)}
                  disabled={busyId === med.id}
                  title="Fire this reminder now (demo aid)"
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted hover:bg-cream-soft disabled:opacity-50"
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Trigger now
                </button>
                <button
                  onClick={() => toggleActive(med)}
                  disabled={busyId === med.id}
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted hover:bg-cream-soft disabled:opacity-50"
                >
                  <Power className="h-3.5 w-3.5" /> {med.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(med.id)}
                  disabled={busyId === med.id}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
