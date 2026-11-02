"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Avatar, fmt, teacherSlug, toMinutes, useData, type AdminState } from "@/components/data";
import { IconBolt, IconCalendar, IconSend, IconUsers } from "@/components/icons";

type Settings = NonNullable<AdminState["settings"]>;

export default function BotPage() {
  const { admin, adminError, reloadAdmin } = useData();

  if (!admin) {
    return (
      <div className="empty-state">
        <h1>Bot</h1>
        <p>{adminError || "Holat yuklanmoqda…"}</p>
        {adminError && <button className="btn btn-ink" onClick={reloadAdmin}>Qayta urinish</button>}
      </div>
    );
  }

  const ready = admin.status.db && admin.status.bot;

  return (
    <div className="bot stagger">
      <header className="page-hero">
        <div>
          <h1 className="display">Bot</h1>
          <p className="lede">
            {admin.bot
              ? <>O&apos;qituvchilarga kunlik darslarni <a href={`https://t.me/${admin.bot.username}`} target="_blank" rel="noreferrer">@{admin.bot.username}</a> yuboradi.</>
              : "Telegram bot hali sozlanmagan."}
          </p>
        </div>
      </header>

      <Tiles />

      <div className="bot-layout">
        <div className="bot-main">
          {(!ready || !admin.status.cron) && <Setup />}
          {admin.settings && <Schedule settings={admin.settings} />}
          {ready && <Broadcast total={admin.subscribers.length} />}
          {admin.status.db && <Subscribers />}
        </div>
        <aside className="bot-aside">
          <Health />
          <History />
        </aside>
      </div>
    </div>
  );
}

// Asosiy raqamlar: obunachilar, keyingi va oxirgi yuborish
function Tiles() {
  const { admin, data } = useData();
  const a = admin!;
  const s = a.settings;
  const chats = new Set(a.subscribers.map((x) => x.chat_id)).size;
  const teachers = new Set(a.subscribers.map((x) => x.teacher_id)).size;
  const active = data!.teachers.filter((t) => t.count > 0).length;

  let next = s ? "o'chirilgan" : "—";
  if (s?.enabled) {
    const sentToday = s.last_sent_date === a.status.now.date;
    const passed = toMinutes(a.status.now.time) >= toMinutes(s.send_time);
    next = `${sentToday || passed ? "ertaga" : "bugun"} ${s.send_time}`;
  }
  const last = a.sends[0];

  const tiles = [
    { Icon: IconUsers, value: fmt(teachers), label: `o'qituvchi ulangan, ${fmt(active)} tadan`, accent: true },
    { Icon: IconSend, value: fmt(chats), label: "Telegram chat" },
    { Icon: IconCalendar, value: next, label: s ? `keyingi yuborish, ${s.send_day === "tomorrow" ? "ertangi" : "bugungi"} darslar` : "sozlanmagan" },
    { Icon: IconBolt, value: last ? fmt(last.sent) : "—", label: last ? `oxirgi yuborishda, ${new Date(last.at).toLocaleDateString("uz", { day: "numeric", month: "short" })}` : "hali yuborilmagan" },
  ];

  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div key={t.label} className={"tile" + (t.accent ? " tile-accent" : "")}>
          <t.Icon />
          <b>{t.value}</b>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// Bot to'liq sozlanmaguncha bajarilishi kerak bo'lgan qadamlar
function Setup() {
  const { admin } = useData();
  const a = admin!;
  const steps = [
    { done: a.status.db, title: "Ma'lumotlar bazasini ulang", text: "Vercel → Storage → Create Database → Neon. DATABASE_URL avtomatik qo'shiladi." },
    { done: a.status.bot, title: "Telegram bot yarating", text: "@BotFather'da /newbot buyrug'i bilan bot oching va tokenni TELEGRAM_BOT_TOKEN sifatida qo'shing." },
    { done: a.status.cron, title: "Cron kalitini qo'shing", text: "CRON_SECRET o'rnating va tashqi cron'da har 5 daqiqada /api/cron/send manzilini chaqiring." },
  ];
  return (
    <section className="block-section" aria-labelledby="setup-title">
      <h2 id="setup-title" className="section-title">Sozlash</h2>
      <p className="muted">Env o&apos;zgaruvchilarni qo&apos;shgandan keyin loyihani qayta deploy qiling.</p>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? "is-done" : ""}>
            <span className="step-num" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
            <span>
              <b>{s.title}</b>
              {s.done ? <span className="muted"> · bajarilgan</span> : <span className="muted step-text">{s.text}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Schedule({ settings }: { settings: Settings }) {
  const { reloadAdmin, notify } = useData();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(settings), [settings]);
  const dirty = s.send_time !== settings.send_time || s.send_day !== settings.send_day || s.enabled !== settings.enabled;

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/settings", "PUT", s);
      await reloadAdmin();
      notify("Sozlamalar saqlandi");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="block-section" aria-labelledby="sched-title">
      <h2 id="sched-title" className="section-title">Kunlik yuborish</h2>
      <p className="sentence">
        {s.enabled
          ? <>Har kuni Toshkent vaqti bilan <b>{s.send_time}</b> da obunachilarga <b>{s.send_day === "tomorrow" ? "ertangi" : "bugungi"}</b> darslari yuboriladi.</>
          : "Kunlik avtomatik yuborish o'chirilgan."}
      </p>

      <div className="form-grid">
        <label className="form-field">
          <span>Vaqt</span>
          <input className="field" type="time" value={s.send_time} onChange={(e) => setS({ ...s, send_time: e.target.value })} />
        </label>
        <div className="form-field">
          <span id="day-label">Qaysi darslar</span>
          <div className="segmented" role="radiogroup" aria-labelledby="day-label">
            <button role="radio" aria-checked={s.send_day === "tomorrow"} onClick={() => setS({ ...s, send_day: "tomorrow" })}>Ertangi</button>
            <button role="radio" aria-checked={s.send_day === "today"} onClick={() => setS({ ...s, send_day: "today" })}>Bugungi</button>
          </div>
        </div>
        <label className="switch">
          <input type="checkbox" role="switch" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          <span className="switch-track" aria-hidden="true" />
          <span>Yoqilgan</span>
        </label>
      </div>

      <div className="form-actions">
        <button className="btn btn-ink" disabled={!dirty || busy} onClick={save}>{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
        {dirty && <button className="btn btn-ghost" onClick={() => setS(settings)}>Bekor qilish</button>}
      </div>
    </section>
  );
}

function Broadcast({ total }: { total: number }) {
  const { reloadAdmin, notify } = useData();
  const [which, setWhich] = useState<"today" | "tomorrow">("today");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await api<{ sent: number; skipped: number; failed: number }>("/api/admin/broadcast", "POST", { which, includeEmpty });
      notify(`Yuborildi: ${r.sent}. Darsi yo'q: ${r.skipped}. Xato: ${r.failed}.`, r.failed ? "error" : "ok");
      await reloadAdmin();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="block-section" aria-labelledby="cast-title">
      <h2 id="cast-title" className="section-title">Hammaga hozir yuborish</h2>
      <p className="muted">Kunlik avtomatik yuborishdan alohida. Avtomatik xabar baribir o&apos;z vaqtida ketadi.</p>

      <div className="form-grid">
        <div className="form-field">
          <span id="which-label">Qaysi darslar</span>
          <div className="segmented" role="radiogroup" aria-labelledby="which-label">
            <button role="radio" aria-checked={which === "today"} onClick={() => setWhich("today")}>Bugungi</button>
            <button role="radio" aria-checked={which === "tomorrow"} onClick={() => setWhich("tomorrow")}>Ertangi</button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} />
          Darsi yo&apos;qlarga ham &quot;dars yo&apos;q&quot; deb yozish
        </label>
      </div>

      <div className="form-actions">
        {confirming ? (
          <>
            <button className="btn btn-signal" disabled={busy} onClick={send}>
              {busy ? "Yuborilmoqda…" : `Ha, ${fmt(total)} ta obunachiga yuborish`}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Bekor qilish</button>
          </>
        ) : (
          <button className="btn btn-ink" disabled={!total} onClick={() => setConfirming(true)}>
            {total ? `${fmt(total)} ta obunachiga yuborish` : "Hali obunachi yo'q"}
          </button>
        )}
      </div>
    </section>
  );
}

function Subscribers() {
  const { admin, teacherById, reloadAdmin, notify } = useData();
  const [confirm, setConfirm] = useState<string | null>(null);
  const subs = admin!.subscribers;

  async function unlink(teacherId: string, chatId: string) {
    try {
      await api("/api/admin/subscribers", "DELETE", { teacherId, chatId });
      await reloadAdmin();
      notify("Chat uzildi");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setConfirm(null);
    }
  }

  return (
    <section className="block-section" aria-labelledby="subs-title">
      <h2 id="subs-title" className="section-title">Obunachilar <span className="muted tabular">{subs.length}</span></h2>
      {subs.length === 0 ? (
        <p className="muted">
          Hali hech kim ulanmagan. <Link href="/teachers">O&apos;qituvchini tanlang</Link> va unga taklif havolasini yuboring.
        </p>
      ) : (
        <table className="plain-table">
          <thead>
            <tr><th scope="col">O&apos;qituvchi</th><th scope="col">Telegram</th><th scope="col" className="hide-sm">Ulangan</th><th scope="col"><span className="sr-only">Amal</span></th></tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const t = teacherById.get(s.teacher_id);
              const key = s.teacher_id + ":" + s.chat_id;
              return (
                <tr key={key}>
                  <td>
                    <Link href={`/teachers/${teacherSlug(s.teacher_id)}`} className="person">
                      <Avatar name={t?.name || "?"} color={t?.color} size="sm" />
                      <span>{t?.name || s.teacher_id}</span>
                    </Link>
                  </td>
                  <td>{s.first_name || "Nomsiz"}{s.username && <span className="muted"> @{s.username}</span>}</td>
                  <td className="hide-sm muted tabular">{new Date(s.created_at).toLocaleDateString("uz", { day: "numeric", month: "short" })}</td>
                  <td className="num">
                    {confirm === key ? (
                      <span className="inline-confirm">
                        <button className="btn btn-danger btn-sm" onClick={() => unlink(s.teacher_id, s.chat_id)}>Uzish</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Bekor</button>
                      </span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(key)}>Uzish</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Health() {
  const { admin, data, reloadAdmin, notify } = useData();
  const [busy, setBusy] = useState(false);
  const a = admin!;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookOk = !!a.bot && a.bot.webhookUrl === `${origin}/api/telegram`;

  async function connect() {
    setBusy(true);
    try {
      await api("/api/admin/webhook", "POST");
      await reloadAdmin();
      notify("Webhook shu saytga ulandi");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const items: { label: string; ok: boolean; detail: React.ReactNode }[] = [
    { label: "Edupage", ok: !!data, detail: data ? `${fmt(data.entries.length)} dars, ${new Date(data.loadedAt).toLocaleTimeString("uz", { hour: "2-digit", minute: "2-digit" })} da olingan` : "yuklanmagan" },
    { label: "Ma'lumotlar bazasi", ok: a.status.db, detail: a.status.db ? "Neon ulangan" : "DATABASE_URL yo'q" },
    { label: "Bot", ok: !!a.bot, detail: a.bot ? `@${a.bot.username}` : "TELEGRAM_BOT_TOKEN yo'q" },
    {
      label: "Webhook",
      ok: webhookOk,
      detail: !a.bot ? "bot kerak"
        : webhookOk ? (a.bot.lastError ? `ulangan, oxirgi xato: ${a.bot.lastError}` : "ulangan")
        : <button className="link-btn" disabled={busy} onClick={connect}>{a.bot.webhookUrl ? "boshqa manzilda, shu saytga ulash" : "shu saytga ulash"}</button>,
    },
    { label: "Cron kaliti", ok: a.status.cron, detail: a.status.cron ? "o'rnatilgan" : "CRON_SECRET yo'q" },
  ];

  return (
    <section className="block-section" aria-labelledby="health-title">
      <h2 id="health-title" className="section-title">Holat</h2>
      <ul className="health">
        {items.map((i) => (
          <li key={i.label}>
            <span className={"dot " + (i.ok ? "ok" : "warn")} aria-hidden="true" />
            <span className="health-label">{i.label}</span>
            <span className="health-detail">{i.detail}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">Toshkent vaqti: {a.status.now.time}</p>
    </section>
  );
}

function History() {
  const { admin } = useData();
  const sends = admin!.sends;
  return (
    <section className="block-section" aria-labelledby="hist-title">
      <h2 id="hist-title" className="section-title">Yuborish tarixi</h2>
      {sends.length === 0 ? (
        <p className="muted">Hali hech narsa yuborilmagan.</p>
      ) : (
        <ol className="history">
          {sends.map((s, i) => (
            <li key={i}>
              <span className="tabular">{new Date(s.at).toLocaleString("uz", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="muted">{s.target_date} uchun</span>
              <span className="tabular">{s.sent} yuborildi{s.failed ? `, ${s.failed} xato` : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
