"use client";

import { useState } from "react";

const STOPS = ["08:00", "09:30", "11:30", "13:00", "14:30", "16:00"];

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) {
      location.href = "/";
      return;
    }
    setError((await res.json().catch(() => ({}))).error || "Kirib bo'lmadi");
    setBusy(false);
  }

  return (
    <main className="login">
      <section className="login-intro">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-name">EMU jadval</span>
        </span>
        <h1 className="display login-title">Dars jadvali va o&apos;qituvchilarga kunlik xabarlar</h1>
        <ol className="login-rail" aria-hidden="true">
          {STOPS.map((t, i) => (
            <li key={t}><span className="stop-dot" /><b>{i + 1}</b><span>{t}</span></li>
          ))}
        </ol>
      </section>

      <form className="login-form" onSubmit={submit}>
        <h2>Admin paneliga kirish</h2>
        <label className="form-field">
          <span>Parol</span>
          <input
            className="field"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
        <button className="btn btn-ink btn-block" disabled={busy || !password}>{busy ? "Tekshirilmoqda…" : "Kirish"}</button>
      </form>
    </main>
  );
}
