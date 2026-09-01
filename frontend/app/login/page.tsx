"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, LogIn } from "lucide-react";
import { apiFetch, setToken } from "@/lib/api";
import { LoginResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@eldercompanion.ai");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      setToken(res.access_token);
      window.localStorage.setItem("ec_caregiver_name", res.caregiver_name);
      window.localStorage.setItem("ec_elder_name", res.elder_name);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <HeartHandshake className="h-8 w-8 text-accent" />
          <h1 className="font-serif text-xl font-medium text-ink">Caregiver login</h1>
          <p className="text-sm text-ink-muted">Demo credentials are pre-filled.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              required
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
