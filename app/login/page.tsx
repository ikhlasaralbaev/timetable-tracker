"use client";

import { useState } from "react";

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
      <form onSubmit={submit}>
        <h1>EMU dars jadvali</h1>
        <p>Admin paneliga kirish uchun parolni kiriting.</p>
        <input type="password" autoFocus autoComplete="current-password" aria-label="Parol" placeholder="Parol" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !password}>Kirish</button>
      </form>
    </main>
  );
}
