"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, DAY_NAMES, DAY_SHORT, duration, fmt, groupsOf, tashkent, teacherSlug, toMinutes, useData } from "@/components/data";
import { IconDoor, IconGroup, IconSearch } from "@/components/icons";
import type { Entry, Period } from "@/lib/edupage";

type Phase = "past" | "now" | "next" | "future";

export default function TodayBoard() {
  const { data, teacherById } = useData();
  const router = useRouter();
  const [now, setNow] = useState(() => tashkent());
  const [day, setDay] = useState(() => (tashkent().weekday > 5 ? 0 : tashkent().weekday));
  const [period, setPeriod] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // Eski havolalar: /#t=*165 → /teachers/165
  useEffect(() => {
    const t = new URLSearchParams(location.hash.slice(1)).get("t");
    if (t) router.replace(`/teachers/${teacherSlug(t)}`);
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setNow(tashkent()), 20_000);
    return () => clearInterval(id);
  }, []);

  const periods = data!.periods;
  const isToday = day === now.weekday;

  const byDay = useMemo(() => {
    const m = Array.from({ length: data!.dayCount }, () => 0);
    for (const e of data!.entries) m[e.day]++;
    return m;
  }, [data]);

  const dayEntries = useMemo(() => data!.entries.filter((e) => e.day === day), [data, day]);

  const phases: Phase[] = useMemo(() => {
    if (!isToday) return periods.map(() => "future");
    const nowIdx = periods.findIndex((p) => now.minutes >= toMinutes(p.starttime) && now.minutes < toMinutes(p.endtime));
    const nextIdx = periods.findIndex((p) => now.minutes < toMinutes(p.starttime));
    return periods.map((p, i) => {
      if (i === nowIdx) return "now";
      if (nowIdx === -1 && i === nextIdx) return "next";
      return now.minutes >= toMinutes(p.endtime) ? "past" : "future";
    });
  }, [isToday, periods, now.minutes]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of dayEntries) m.set(e.period, (m.get(e.period) || 0) + 1);
    return m;
  }, [dayEntries]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dayEntries
      .filter((e) => period === null || e.period === period)
      .filter((e) => !needle || [e.subject, ...e.teachers, ...e.classes, ...e.groups, ...e.rooms].join(" ").toLowerCase().includes(needle))
      // Para bo'yicha, ichida xona bo'yicha; xonasizlar oxirida
      .sort((a, b) => a.period - b.period || (a.rooms[0] || "￿").localeCompare(b.rooms[0] || "￿", "uz", { numeric: true }));
  }, [dayEntries, period, q]);

  const grouped = useMemo(() => {
    const m = new Map<number, Entry[]>();
    for (const e of rows) m.set(e.period, [...(m.get(e.period) || []), e]);
    return [...m.entries()];
  }, [rows]);

  const stats = {
    lessons: dayEntries.length,
    teachers: new Set(dayEntries.flatMap((e) => e.teacherIds)).size,
    rooms: new Set(dayEntries.flatMap((e) => e.rooms)).size,
  };

  return (
    <div className="board stagger">
      <Hero
        isToday={isToday}
        dayName={DAY_NAMES[day]}
        dateLabel={now.label}
        sunday={now.weekday > 5}
        periods={periods}
        phases={phases}
        counts={counts}
        minutes={now.minutes}
        stats={stats}
        selected={period}
        onSelect={setPeriod}
      />

      <div className="day-chips" role="tablist" aria-label="Hafta kuni">
        {byDay.map((n, d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === day}
            className={"day-chip" + (d === now.weekday ? " is-today" : "")}
            onClick={() => { setDay(d); setPeriod(null); }}
          >
            <span className="day-chip-name"><span className="only-sm">{DAY_SHORT[d]}</span><span className="only-lg">{DAY_NAMES[d]}</span></span>
            <span className="day-chip-count">{fmt(n)}</span>
          </button>
        ))}
      </div>

      <div className="board-tools">
        <label className="field-icon">
          <IconSearch />
          <input
            type="search"
            placeholder="Fan, o'qituvchi, guruh yoki xona"
            aria-label="Darslar ichida qidirish"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {period !== null && (
          <button className="chip is-on" onClick={() => setPeriod(null)}>
            {period}-para <span aria-hidden="true">×</span>
            <span className="sr-only">filtrini olib tashlash</span>
          </button>
        )}
        <span className="muted tabular count-note">{fmt(rows.length)} ta dars</span>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-inline">
          {dayEntries.length ? "Bu filtr bo'yicha dars topilmadi." : `${DAY_NAMES[day]} kuni dars yo'q.`}
        </div>
      ) : (
        grouped.map(([p, list]) => {
          const idx = periods.findIndex((x) => x.period === p);
          const meta = periods[idx];
          return (
            <section key={p} className={"slot-group phase-" + phases[idx]} aria-labelledby={`slot-${p}`}>
              <h2 id={`slot-${p}`} className="slot-head">
                <span className="slot-num">{p}</span>
                <span className="slot-label">
                  <b>{p}-para</b>
                  <span className="muted tabular">{meta?.starttime}–{meta?.endtime}</span>
                </span>
                {phases[idx] === "now" && <span className="live-pill">hozir</span>}
                <span className="slot-count">{fmt(list.length)} dars</span>
              </h2>
              <ul className="lessons">
                {list.map((e) => (
                  <li key={e.id} className="lesson" style={{ ["--c" as string]: e.color }}>
                    <div className="lesson-subject">
                      <span>{e.subject}</span>
                      {e.duration > 1 && <span className="tag">{e.duration} para</span>}
                    </div>
                    <div className="lesson-teachers">
                      {e.teacherIds.length ? e.teacherIds.map((id, i) => (
                        <Link key={id} href={`/teachers/${teacherSlug(id)}`} className="person">
                          <Avatar name={e.teachers[i] || "?"} color={teacherById.get(id)?.color} size="sm" />
                          <span>{e.teachers[i]}</span>
                        </Link>
                      )) : <span className="muted">O&apos;qituvchi ko&apos;rsatilmagan</span>}
                    </div>
                    <div className="lesson-groups"><IconGroup />{groupsOf(e) || "—"}</div>
                    <div className="lesson-room">{e.rooms.length ? <><IconDoor /><span>{e.rooms.join(", ")}</span></> : <span className="muted">xona yo&apos;q</span>}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

/* ---------- Jonli taxta ---------- */

function Hero({ isToday, dayName, dateLabel, sunday, periods, phases, counts, minutes, stats, selected, onSelect }: {
  isToday: boolean;
  dayName: string;
  dateLabel: string;
  sunday: boolean;
  periods: Period[];
  phases: Phase[];
  counts: Map<number, number>;
  minutes: number;
  stats: { lessons: number; teachers: number; rooms: number };
  selected: number | null;
  onSelect: (p: number | null) => void;
}) {
  const nowIdx = phases.indexOf("now");
  const nextIdx = phases.indexOf("next");
  const cur = nowIdx >= 0 ? periods[nowIdx] : null;
  const next = nextIdx >= 0 ? periods[nextIdx] : null;
  const done = isToday && !cur && !next;

  let kicker: string;
  let big: string;
  let title: string;
  let detail: string;
  let progress = 0;

  if (!isToday) {
    kicker = sunday ? "Bugun yakshanba" : dateLabel;
    big = dayName.slice(0, 2);
    title = `${dayName} jadvali`;
    detail = `${periods.length} para, ${fmt(stats.lessons)} ta dars`;
  } else if (cur) {
    const start = toMinutes(cur.starttime);
    const end = toMinutes(cur.endtime);
    progress = (minutes - start) / (end - start);
    kicker = "Hozir";
    big = String(cur.period);
    title = `${cur.period}-para, ${cur.starttime}–${cur.endtime}`;
    detail = `${duration(end - minutes)} qoldi · ${fmt(counts.get(cur.period) || 0)} ta dars o'tilmoqda`;
  } else if (next) {
    kicker = next.period === periods[0].period ? "Kun boshlanmoqda" : "Tanaffus";
    big = String(next.period);
    title = `${next.period}-para ${next.starttime} da`;
    detail = `${duration(toMinutes(next.starttime) - minutes)}dan keyin · ${fmt(counts.get(next.period) || 0)} ta dars`;
  } else {
    kicker = dateLabel;
    big = "✓";
    title = "Bugungi darslar tugadi";
    detail = `${fmt(stats.lessons)} ta dars o'tildi`;
    progress = 1;
  }

  return (
    <section className={"hero" + (cur ? " is-live" : "") + (done ? " is-done" : "")} aria-label="Kun holati">
      <div className="hero-top">
        <div className="hero-now">
          <span className="hero-big" aria-hidden="true">{big}</span>
          <div className="hero-text">
            <span className="hero-kicker">{cur && <span className="pulse-dot" aria-hidden="true" />}{kicker}</span>
            <h1 className="hero-title">{title}</h1>
            <p className="hero-detail">{detail}</p>
            {cur && <div className="hero-progress" aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          </div>
        </div>
        <dl className="hero-stats">
          <div><dt>dars</dt><dd>{fmt(stats.lessons)}</dd></div>
          <div><dt>o&apos;qituvchi</dt><dd>{fmt(stats.teachers)}</dd></div>
          <div><dt>xona</dt><dd>{fmt(stats.rooms)}</dd></div>
        </dl>
      </div>
      <Rail periods={periods} phases={phases} counts={counts} selected={selected} onSelect={onSelect} now={isToday ? minutes : null} />
    </section>
  );
}

// Paralar chizig'i: kun bo'ylab "bekatlar"
function Rail({ periods, phases, counts, selected, onSelect, now }: {
  periods: Period[];
  phases: Phase[];
  counts: Map<number, number>;
  selected: number | null;
  onSelect: (p: number | null) => void;
  now: number | null;
}) {
  // Nuqtalar teng oraliqda: progress paralar boshlanish vaqtlari orasida interpolyatsiya qilinadi
  const starts = periods.map((p) => toMinutes(p.starttime));
  const lastEnd = toMinutes(periods[periods.length - 1]?.endtime || "18:00");
  let pos = 0;
  if (now !== null && periods.length > 1) {
    const edges = [...starts.slice(1), lastEnd];
    for (let i = 0; i < periods.length; i++) {
      if (now >= starts[i]) pos = Math.min(periods.length - 1, i + Math.min(1, (now - starts[i]) / (edges[i] - starts[i])));
    }
  }
  const progress = periods.length > 1 ? pos / (periods.length - 1) : 0;
  const max = Math.max(1, ...counts.values());

  return (
    <div className="rail" style={{ ["--progress" as string]: progress, ["--stops" as string]: periods.length }}>
      <div className="rail-inner">
        <div className="rail-track" aria-hidden="true"><div className="rail-fill" /></div>
        <ol className="rail-stops">
          {periods.map((p, i) => {
            const n = counts.get(p.period) || 0;
            return (
              <li key={p.period}>
                <button
                  className={"stop phase-" + phases[i]}
                  aria-pressed={selected === p.period}
                  onClick={() => onSelect(selected === p.period ? null : p.period)}
                  aria-label={`${p.period}-para, ${p.starttime}–${p.endtime}, ${n} dars. Filtrlash`}
                >
                  <span className="stop-dot" aria-hidden="true" />
                  <span className="stop-num">{p.period}</span>
                  <span className="stop-time tabular">{p.starttime}</span>
                  <span className="stop-load" aria-hidden="true"><span style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="stop-count tabular">{fmt(n)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
