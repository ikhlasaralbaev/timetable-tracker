"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, Avatar, DAY_NAMES, DAY_SHORT, fmt, groupsOf, tashkent, teacherIdFromSlug, toMinutes, useData } from "@/components/data";
import { IconBack, IconCheck, IconCopy, IconDoor, IconGroup, IconLink, IconSend } from "@/components/icons";
import type { Entry, Teacher } from "@/lib/edupage";

export default function TeacherPage({ slug }: { slug: string }) {
  const { data, teacherById } = useData();
  const [view, setView] = useState<"week" | "days">("week");
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

  const now = tashkent();
  const today = lessons.filter((e) => e.day === now.weekday);
  const stats: [number, string][] = [
    [lessons.length, "dars"],
    [lessons.reduce((s, e) => s + e.duration, 0), "para"],
    [new Set(lessons.map((e) => e.day)).size, "kun"],
    [new Set(lessons.flatMap((e) => e.classes)).size, "guruh"],
  ];

  return (
    <div className="teacher stagger">
      <Link href="/teachers" className="back-link"><IconBack />O&apos;qituvchilar</Link>

      <header className="teacher-hero" style={{ ["--c" as string]: teacher.color }}>
        <Avatar name={teacher.name} color={teacher.color} size="xl" />
        <div className="teacher-hero-text">
          <h1 className="display teacher-name">{teacher.name}</h1>
          <p className="teacher-today">
            {now.weekday > 5 ? "Bugun yakshanba."
              : today.length ? <>Bugun <b>{today.length} ta dars</b>: {today.map((e) => `${e.period}-para`).join(", ")}.</>
              : "Bugun darsi yo'q."}
          </p>
        </div>
        <dl className="teacher-stats">
          {stats.map(([v, l]) => <div key={l}><dd>{fmt(v)}</dd><dt>{l}</dt></div>)}
        </dl>
      </header>

      <div className="teacher-layout">
        <TelegramPanel teacher={teacher} />

        <section className="teacher-main" aria-label="Haftalik jadval">
          <div className="section-bar">
            <h2 className="section-title">Haftalik jadval</h2>
            <div className="segmented only-lg-flex" role="tablist" aria-label="Ko'rinish">
              <button role="tab" aria-selected={view === "week"} onClick={() => setView("week")}>Hafta</button>
              <button role="tab" aria-selected={view === "days"} onClick={() => setView("days")}>Kunlar</button>
            </div>
          </div>
          {lessons.length === 0 ? (
            <div className="empty-inline">Bu o&apos;qituvchining joriy jadvalda darsi yo&apos;q.</div>
          ) : (
            <>
              {/* Desktop: hafta grid'i yoki kunlar; mobil: har doim kunlar */}
              {view === "week" && <div className="only-lg"><WeekGrid lessons={lessons} teacherId={id} /></div>}
              <div className={view === "week" ? "only-sm" : ""}><Agenda lessons={lessons} teacherId={id} /></div>
            </>
          )}
        </section>
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

// Kunlar bo'yicha vertikal "marshrut" (mobil'da asosiy ko'rinish)
function Agenda({ lessons, teacherId }: { lessons: Entry[]; teacherId: string }) {
  const { data } = useData();
  const now = tashkent();
  const days = Array.from({ length: data!.dayCount }, (_, d) => lessons.filter((e) => e.day === d).length);
  const firstWithLessons = days.findIndex(Boolean);
  const [day, setDay] = useState(() => (now.weekday <= 5 && days[now.weekday] ? now.weekday : Math.max(0, firstWithLessons)));
  const list = lessons.filter((e) => e.day === day);

  return (
    <div className="agenda">
      <div className="day-chips compact" role="tablist" aria-label="Hafta kuni">
        {days.map((n, d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === day}
            className={"day-chip" + (d === now.weekday ? " is-today" : "") + (n ? "" : " is-empty")}
            onClick={() => setDay(d)}
          >
            <span className="day-chip-name">{DAY_SHORT[d]}</span>
            <span className="day-chip-count">{n || "–"}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty-inline">{DAY_NAMES[day]} kuni darsi yo&apos;q.</div>
      ) : (
        <ol className="route">
          {list.map((e) => {
            const others = e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId);
            const isNow = day === now.weekday && now.minutes >= toMinutes(e.start) && now.minutes < toMinutes(e.end);
            return (
              <li key={e.id} className={"route-stop" + (isNow ? " is-now" : "")} style={{ ["--c" as string]: e.color }}>
                <div className="route-time tabular">
                  <b>{e.start}</b>
                  <span>{e.end}</span>
                </div>
                <div className="route-card">
                  <div className="route-top">
                    <span className="route-para">{e.duration > 1 ? `${e.period}–${e.period + e.duration - 1}` : e.period}-para</span>
                    {isNow && <span className="live-pill">hozir</span>}
                  </div>
                  <b className="route-subject">{e.subject}</b>
                  <div className="route-meta">
                    {groupsOf(e) && <span><IconGroup />{groupsOf(e)}</span>}
                    {e.rooms.length > 0 && <span><IconDoor />{e.rooms.join(", ")}</span>}
                  </div>
                  {others.length > 0 && <p className="route-with muted">Birga: {others.join(", ")}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
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

  const share = async () => {
    if (!shownLink) return;
    if (navigator.share) {
      await navigator.share({ title: "EMU jadval", text: `${teacher.name}, dars jadvalingizni Telegram'da olish uchun havolani oching:`, url: shownLink.url }).catch(() => {});
    } else {
      await copy();
    }
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
    <aside className={"tg-panel" + (chats.length ? " is-linked" : "")} aria-label="Telegram">
      <div className="tg-head">
        <span className="tg-icon" aria-hidden="true"><IconSend /></span>
        <div>
          <h2 className="section-title">Telegram</h2>
          <span className={"status" + (chats.length ? " on" : "")}>{chats.length ? `${chats.length} ta chat ulangan` : "Ulanmagan"}</span>
        </div>
      </div>

      {!admin ? (
        <p className="muted">{adminError || "Yuklanmoqda…"}</p>
      ) : !ready ? (
        <p className="muted">Bot hali sozlanmagan. <Link href="/bot">Bot sahifasida</Link> holatni tekshiring.</p>
      ) : (
        <>
          {chats.length > 0 ? (
            <ul className="tg-chats">
              {chats.map((c) => (
                <li key={c.chat_id}>
                  <span className="tg-who">
                    <b>{c.first_name || "Nomsiz"}</b>
                    <small className="muted">{c.username ? `@${c.username} · ` : ""}{new Date(c.created_at).toLocaleDateString("uz", { day: "numeric", month: "long" })} dan</small>
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
            <p className="muted tg-intro">O&apos;qituvchi havolani ochib Start bosgach, unga har kuni darslari yuboriladi.</p>
          )}

          {shownLink && (
            <div className="invite">
              <span className="invite-url"><IconLink />{shownLink.url.replace("https://", "")}</span>
              <div className="invite-actions">
                <button className="btn btn-ink" onClick={copy}>{copied ? <><IconCheck />Nusxalandi</> : <><IconCopy />Nusxalash</>}</button>
                <button className="btn btn-ghost" onClick={share}>Ulashish</button>
              </div>
              <p className="muted small">
                Bir martalik, {new Date(shownLink.expiresAt).toLocaleDateString("uz", { day: "numeric", month: "long" })} gacha amal qiladi.
              </p>
            </div>
          )}

          <button className={"btn " + (shownLink ? "btn-ghost" : "btn-ink") + " btn-block"} disabled={busy === "link"} onClick={createLink}>
            <IconLink />{busy === "link" ? "Yaratilmoqda…" : shownLink ? "Yangi havola yaratish" : "Taklif havolasini yaratish"}
          </button>

          {chats.length > 0 && (
            <div className="tg-send">
              <span className="muted small">Hozir yuborish:</span>
              <button className="chip" disabled={!!busy} onClick={() => sendNow("today")}>Bugungi</button>
              <button className="chip" disabled={!!busy} onClick={() => sendNow("tomorrow")}>Ertangi</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
