"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, DAY_NAMES, fmt, groupsOf, tashkent, teacherIdFromSlug, toMinutes, useData } from "@/components/data";
import type { Entry, Teacher } from "@/lib/edupage";

export default function TeacherPage({ slug }: { slug: string }) {
  const { data, teacherById } = useData();
  const [view, setView] = useState<"week" | "list">("week");
  const id = teacherIdFromSlug(slug, teacherById);
  const teacher = teacherById.get(id);

  const lessons = useMemo(
    () => data!.entries.filter((e) => e.teacherIds.includes(id)).sort((a, b) => a.day - b.day || a.period - b.period),
    [data, id],
  );

  if (!teacher) {
    return (
      <div className="empty-state">
        <h1>O&apos;qituvchi topilmadi</h1>
        <p>Bu havoladagi o&apos;qituvchi joriy jadvalda yo&apos;q. U edupage&apos;dan olib tashlangan bo&apos;lishi mumkin.</p>
        <Link className="btn btn-ink" href="/teachers">O&apos;qituvchilar ro&apos;yxatiga qaytish</Link>
      </div>
    );
  }

  const paras = lessons.reduce((s, e) => s + e.duration, 0);
  const days = new Set(lessons.map((e) => e.day)).size;
  const groups = new Set(lessons.flatMap((e) => e.classes)).size;

  return (
    <div className="teacher">
      <Link href="/teachers" className="back-link">← O&apos;qituvchilar</Link>

      <header className="teacher-head">
        <h1 className="display teacher-name">
          <span className="swatch swatch-lg" style={{ ["--c" as string]: teacher.color }} />
          {teacher.name}
        </h1>
        <p className="lede">
          Haftasiga {fmt(lessons.length)} dars, {fmt(paras)} para. {days} kun ishlaydi, {groups} ta guruhga dars beradi.
        </p>
      </header>

      <div className="teacher-layout">
        <section className="teacher-main" aria-label="Haftalik jadval">
          <div className="section-bar">
            <h2 className="section-title">Haftalik jadval</h2>
            <div className="segmented" role="tablist" aria-label="Ko'rinish">
              <button role="tab" aria-selected={view === "week"} onClick={() => setView("week")}>Hafta</button>
              <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")}>Ro&apos;yxat</button>
            </div>
          </div>
          {lessons.length === 0
            ? <div className="empty-inline">Bu o&apos;qituvchining joriy jadvalda darsi yo&apos;q.</div>
            : view === "week" ? <WeekGrid lessons={lessons} teacherId={id} /> : <DayList lessons={lessons} teacherId={id} />}
        </section>

        <TelegramPanel teacher={teacher} />
      </div>
    </div>
  );
}

function WeekGrid({ lessons, teacherId }: { lessons: Entry[]; teacherId: string }) {
  const { data } = useData();
  const { periods, dayCount } = data!;
  const now = tashkent();
  const nowPeriod = periods.find((p) => now.minutes >= toMinutes(p.starttime) && now.minutes < toMinutes(p.endtime))?.period;

  return (
    <div className="week-scroll">
      <div className="week" style={{ ["--cols" as string]: periods.length }}>
        <div className="wk-corner" />
        {periods.map((p) => (
          <div key={p.period} className={"wk-head" + (p.period === nowPeriod ? " is-now" : "")}>
            <span className="wk-num">{p.period}</span>
            <span className="tabular">{p.starttime}–{p.endtime}</span>
          </div>
        ))}

        {Array.from({ length: dayCount }, (_, d) => {
          const row = lessons.filter((e) => e.day === d);
          const today = d === now.weekday;
          const cells: React.ReactNode[] = [];
          for (let i = 0; i < periods.length;) {
            const here = row.filter((e) => e.period === periods[i].period);
            const span = Math.min(Math.max(1, ...here.map((e) => e.duration)), periods.length - i);
            cells.push(
              <div key={`${d}:${i}`} className={"wk-cell" + (today ? " is-today" : "")} style={{ gridColumn: `span ${span}` }}>
                {here.map((e) => <LessonBlock key={e.id} e={e} teacherId={teacherId} />)}
              </div>,
            );
            i += span;
          }
          return [
            <div key={"d" + d} className={"wk-day" + (today ? " is-today" : "")}>
              <span>{DAY_NAMES[d]}</span>
              <small>{row.length ? `${row.length} dars` : "bo'sh"}</small>
            </div>,
            ...cells,
          ];
        })}
      </div>
    </div>
  );
}

function LessonBlock({ e, teacherId }: { e: Entry; teacherId: string }) {
  const others = e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId);
  return (
    <div className="block" style={{ ["--c" as string]: e.color }}>
      <span className="block-subject">{e.subject}</span>
      {groupsOf(e) && <span className="block-meta">{groupsOf(e)}</span>}
      {others.length > 0 && <span className="block-meta">bilan: {others.join(", ")}</span>}
      {e.rooms.length > 0 && <span className="block-room">{e.rooms.join(", ")}</span>}
    </div>
  );
}

function DayList({ lessons, teacherId }: { lessons: Entry[]; teacherId: string }) {
  const days = [...new Set(lessons.map((e) => e.day))];
  return (
    <div className="day-list">
      {days.map((d) => (
        <section key={d} aria-labelledby={`dl-${d}`}>
          <h3 id={`dl-${d}`} className="day-list-title">{DAY_NAMES[d]}</h3>
          <ul className="lesson-rows">
            {lessons.filter((e) => e.day === d).map((e) => {
              const others = e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId);
              return (
                <li key={e.id} className="lesson-row compact" style={{ ["--c" as string]: e.color }}>
                  <span className="lr-when tabular">
                    <b>{e.duration > 1 ? `${e.period}–${e.period + e.duration - 1}` : e.period}-para</b> {e.start}–{e.end}
                  </span>
                  <span className="lr-subject">{e.subject}{others.length > 0 && <span className="muted"> · {others.join(", ")}</span>}</span>
                  <span className="lr-groups">{groupsOf(e) || "—"}</span>
                  <span className="lr-room">{e.rooms.join(", ") || "—"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------- Telegram paneli ---------- */

function TelegramPanel({ teacher }: { teacher: Teacher }) {
  const { admin, adminError, reloadAdmin, notify } = useData();
  const [link, setLink] = useState<{ teacherId: string; url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ready = !!admin?.status.db && !!admin?.status.bot;
  const chats = (admin?.subscribers || []).filter((s) => s.teacher_id === teacher.id);
  const shownLink = link?.teacherId === teacher.id ? link : null;

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try { await fn(); } catch (e) { notify((e as Error).message, "error"); } finally { setBusy(null); }
  }

  const createLink = () => run("link", async () => {
    const r = await api<{ link: string; expiresAt: string }>("/api/admin/invite", "POST", { teacherId: teacher.id });
    setLink({ teacherId: teacher.id, url: r.link, expiresAt: r.expiresAt });
    setCopied(false);
  });

  const copy = async () => {
    if (!shownLink) return;
    await navigator.clipboard.writeText(shownLink.url);
    setCopied(true);
    notify("Havola nusxalandi");
  };

  const unlink = (chatId: string) => run("unlink", async () => {
    await api("/api/admin/subscribers", "DELETE", { teacherId: teacher.id, chatId });
    setConfirmUnlink(null);
    await reloadAdmin();
    notify("Chat uzildi");
  });

  const sendNow = (which: "today" | "tomorrow") => run("send-" + which, async () => {
    const r = await api<{ sent: number; failed: number; errors: string[] }>("/api/admin/send", "POST", { teacherId: teacher.id, which });
    if (r.failed) notify(`Yuborilmadi: ${r.errors.join("; ")}`, "error");
    else notify(`${which === "today" ? "Bugungi" : "Ertangi"} darslar ${r.sent} ta chatga yuborildi`);
  });

  return (
    <aside className="tg-panel" aria-label="Telegram">
      <div className="tg-head">
        <h2 className="section-title">Telegram</h2>
        <span className={"status" + (chats.length ? " on" : "")}>{chats.length ? `${chats.length} ta chat` : "Ulanmagan"}</span>
      </div>

      {!admin ? (
        <p className="muted">{adminError || "Yuklanmoqda…"}</p>
      ) : !ready ? (
        <p className="muted">
          Bot hali sozlanmagan. <Link href="/bot">Bot sahifasida</Link> holatni tekshiring.
        </p>
      ) : (
        <>
          {chats.length > 0 ? (
            <ul className="tg-chats">
              {chats.map((c) => (
                <li key={c.chat_id}>
                  <span className="tg-who">
                    {c.first_name || "Nomsiz"}{c.username && <span className="muted"> @{c.username}</span>}
                    <small className="muted">{new Date(c.created_at).toLocaleDateString("uz", { day: "numeric", month: "long" })} dan</small>
                  </span>
                  {confirmUnlink === c.chat_id ? (
                    <span className="inline-confirm">
                      <button className="btn btn-danger btn-sm" disabled={busy === "unlink"} onClick={() => unlink(c.chat_id)}>Uzish</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmUnlink(null)}>Bekor</button>
                    </span>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmUnlink(c.chat_id)}>Uzish</button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted tg-intro">
              O&apos;qituvchi havolani ochib Start bosgach, unga har kuni darslari yuboriladi.
            </p>
          )}

          {shownLink && (
            <div className="invite">
              <code className="invite-url">{shownLink.url}</code>
              <button className="btn btn-ink" onClick={copy}>{copied ? "Nusxalandi" : "Havolani nusxalash"}</button>
              <p className="muted small">
                Bir martalik, {new Date(shownLink.expiresAt).toLocaleDateString("uz", { day: "numeric", month: "long" })} gacha amal qiladi.
              </p>
            </div>
          )}

          <button className={"btn " + (shownLink ? "btn-ghost" : "btn-ink") + " btn-block"} disabled={busy === "link"} onClick={createLink}>
            {busy === "link" ? "Yaratilmoqda…" : shownLink ? "Yangi havola yaratish" : "Taklif havolasini yaratish"}
          </button>

          {chats.length > 0 && (
            <div className="tg-send">
              <span className="muted small">Hozir yuborish:</span>
              <button className="link-btn" disabled={!!busy} onClick={() => sendNow("today")}>bugungi</button>
              <button className="link-btn" disabled={!!busy} onClick={() => sendNow("tomorrow")}>ertangi</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
