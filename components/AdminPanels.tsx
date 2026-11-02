"use client";

import { useState } from "react";

export type AdminState = {
  status: { db: boolean; bot: boolean; cron: boolean; now: { date: string; time: string } };
  settings: { send_time: string; send_day: "today" | "tomorrow"; enabled: boolean; last_sent_date: string | null } | null;
  subscribers: { teacher_id: string; chat_id: string; username: string | null; first_name: string | null; created_at: string }[];
  sends: { at: string; target_date: string; sent: number; skipped: number; failed: number }[];
  bot: { username: string; webhookUrl: string; pending: number; lastError: string | null } | null;
};

async function api<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Server ${res.status} javob qaytardi`);
  return json as T;
}

function Missing({ state }: { state: AdminState }) {
  const missing = [
    !state.status.db && "DATABASE_URL (Vercel → Storage → Neon)",
    !state.status.bot && "TELEGRAM_BOT_TOKEN (@BotFather)",
  ].filter(Boolean);
  if (!missing.length) return null;
  return (
    <p className="notice">
      Bot ishlashi uchun Vercel'da quyidagilarni o&apos;rnating: {missing.join(", ")}.
    </p>
  );
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString("uz", { day: "numeric", month: "short", year: "numeric" });

/* ---------- O'qituvchi sahifasidagi Telegram bloki ---------- */

export function TeacherBot({ teacherId, state, onChange }: { teacherId: string; state: AdminState | null; onChange: () => void }) {
  const [link, setLink] = useState<{ teacherId: string; url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!state) return null;
  const ready = state.status.db && state.status.bot;
  const chats = state.subscribers.filter((s) => s.teacher_id === teacherId);
  const shownLink = link?.teacherId === teacherId ? link : null;

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setMessage(null);
    try { await fn(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(null); }
  }

  const createLink = () => run("link", async () => {
    const r = await api<{ link: string; expiresAt: string }>("/api/admin/invite", "POST", { teacherId });
    setLink({ teacherId, url: r.link, expiresAt: r.expiresAt });
    setCopied(false);
  });

  const copy = async () => {
    if (!shownLink) return;
    await navigator.clipboard.writeText(shownLink.url);
    setCopied(true);
  };

  const unlink = (chatId: string) => run("unlink:" + chatId, async () => {
    await api("/api/admin/subscribers", "DELETE", { teacherId, chatId });
    onChange();
  });

  const sendNow = (which: "today" | "tomorrow") => run("send:" + which, async () => {
    const r = await api<{ sent: number; failed: number; errors: string[] }>("/api/admin/send", "POST", { teacherId, which });
    setMessage(r.failed ? `Yuborilmadi: ${r.errors.join("; ")}` : `${r.sent} ta chatga yuborildi.`);
  });

  return (
    <section className="panel" aria-label="Telegram">
      <div className="panel-head">
        <h3>Telegram</h3>
        <span className={"badge" + (chats.length ? " on" : "")}>{chats.length ? `${chats.length} ta chat ulangan` : "Ulanmagan"}</span>
      </div>

      {!ready ? <Missing state={state} /> : (
        <>
          {chats.length > 0 && (
            <ul className="chat-list">
              {chats.map((c) => (
                <li key={c.chat_id}>
                  <span>{c.first_name || "—"}{c.username ? ` (@${c.username})` : ""}<small> · {fmtDate(c.created_at)} dan</small></span>
                  <button className="btn small" disabled={busy === "unlink:" + c.chat_id} onClick={() => unlink(c.chat_id)}>Uzish</button>
                </li>
              ))}
            </ul>
          )}

          {shownLink ? (
            <div className="linkbox">
              <input readOnly value={shownLink.url} aria-label="Taklif havolasi" onFocus={(e) => e.target.select()} />
              <button className="btn primary" onClick={copy}>{copied ? "Nusxalandi" : "Nusxalash"}</button>
              <p>Havolani o&apos;qituvchiga yuboring. U bir marta ishlaydi va {fmtDate(shownLink.expiresAt)} gacha amal qiladi.</p>
            </div>
          ) : null}

          <div className="actions">
            <button className="btn primary" disabled={busy === "link"} onClick={createLink}>
              {shownLink ? "Yangi havola yaratish" : "Havola yaratish"}
            </button>
            {chats.length > 0 && (
              <>
                <button className="btn" disabled={!!busy} onClick={() => sendNow("today")}>Bugungisini yuborish</button>
                <button className="btn" disabled={!!busy} onClick={() => sendNow("tomorrow")}>Ertangisini yuborish</button>
              </>
            )}
          </div>
        </>
      )}
      {message && <p className="form-note" role="status">{message}</p>}
    </section>
  );
}

/* ---------- Bosh sahifadagi bot sozlamalari ---------- */

export function BotSettings({ state, onChange }: { state: AdminState | null; onChange: () => void }) {
  const [draft, setDraft] = useState<AdminState["settings"]>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [castDay, setCastDay] = useState<"today" | "tomorrow">("today");
  const [castEmpty, setCastEmpty] = useState(false);

  if (!state) return null;
  const s = draft ?? state.settings;
  const webhookOk = !!state.bot && typeof window !== "undefined" && state.bot.webhookUrl === `${window.location.origin}/api/telegram`;

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMessage(null);
    try { setMessage(await fn()); onChange(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(null); }
  }

  const save = () => run("save", async () => {
    await api("/api/admin/settings", "PUT", s);
    setDraft(null);
    return "Sozlamalar saqlandi.";
  });

  const connectWebhook = () => run("webhook", async () => {
    const r = await api<{ url: string }>("/api/admin/webhook", "POST");
    return `Webhook ulandi: ${r.url}`;
  });

  const broadcast = () => {
    const total = state.subscribers.length;
    const day = castDay === "today" ? "bugungi" : "ertangi";
    if (!confirm(`${total} ta obunachiga ${day} darslar hozir yuboriladi. Davom etasizmi?`)) return;
    run("broadcast", async () => {
      const r = await api<{ sent: number; skipped: number; failed: number }>("/api/admin/broadcast", "POST", { which: castDay, includeEmpty: castEmpty });
      return `Yuborildi: ${r.sent}, darsi yo'q: ${r.skipped}, xato: ${r.failed}.`;
    });
  };

  return (
    <section className="panel" aria-label="Bot sozlamalari">
      <div className="panel-head">
        <h3>Bot sozlamalari</h3>
        {state.bot && <a className="badge on" href={`https://t.me/${state.bot.username}`} target="_blank" rel="noreferrer">@{state.bot.username}</a>}
      </div>

      <Missing state={state} />

      {s && (
        <div className="settings-row">
          <label>
            Yuborish vaqti
            <input type="time" value={s.send_time} onChange={(e) => setDraft({ ...s, send_time: e.target.value })} />
          </label>
          <label>
            Qaysi darslar
            <select value={s.send_day} onChange={(e) => setDraft({ ...s, send_day: e.target.value as "today" | "tomorrow" })}>
              <option value="tomorrow">Ertangi</option>
              <option value="today">Bugungi</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.enabled} onChange={(e) => setDraft({ ...s, enabled: e.target.checked })} />
            Kunlik yuborish yoqilgan
          </label>
          <button className="btn primary" disabled={!draft || busy === "save"} onClick={save}>Saqlash</button>
        </div>
      )}

      <dl className="facts">
        <div><dt>Ulangan chatlar</dt><dd>{state.subscribers.length}</dd></div>
        <div><dt>Toshkent vaqti</dt><dd>{state.status.now.time}</dd></div>
        <div><dt>Oxirgi yuborish</dt><dd>{state.sends[0] ? `${state.sends[0].target_date}: ${state.sends[0].sent} yuborildi, ${state.sends[0].failed} xato` : "hali yo'q"}</dd></div>
        <div><dt>Cron kaliti</dt><dd>{state.status.cron ? "o'rnatilgan" : "CRON_SECRET yo'q"}</dd></div>
        {state.bot && (
          <div>
            <dt>Webhook</dt>
            <dd>
              {webhookOk ? "ulangan" : state.bot.webhookUrl ? "boshqa manzilga ulangan" : "ulanmagan"}
              {state.bot.lastError && <small> · oxirgi xato: {state.bot.lastError}</small>}
            </dd>
          </div>
        )}
      </dl>

      {state.status.db && state.status.bot && (
        <div className="broadcast">
          <h4>Hammaga hozir yuborish</h4>
          <div className="settings-row">
            <label>
              Qaysi darslar
              <select value={castDay} onChange={(e) => setCastDay(e.target.value as "today" | "tomorrow")}>
                <option value="today">Bugungi</option>
                <option value="tomorrow">Ertangi</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={castEmpty} onChange={(e) => setCastEmpty(e.target.checked)} />
              Darsi yo&apos;qlarga ham xabar yuborish
            </label>
            <button className="btn primary" disabled={!state.subscribers.length || busy === "broadcast"} onClick={broadcast}>
              {busy === "broadcast" ? "Yuborilmoqda…" : `${state.subscribers.length} ta obunachiga yuborish`}
            </button>
          </div>
        </div>
      )}

      <div className="actions">
        {state.bot && !webhookOk && (
          <button className="btn primary" disabled={busy === "webhook"} onClick={connectWebhook}>Webhook&apos;ni shu saytga ulash</button>
        )}
        <button className="btn" onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}>Chiqish</button>
      </div>
      {message && <p className="form-note" role="status">{message}</p>}
    </section>
  );
}
