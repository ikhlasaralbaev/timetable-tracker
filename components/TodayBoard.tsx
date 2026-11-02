"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DAY_NAMES, DAY_SHORT, fmt, groupsOf, tashkent, teacherSlug, toMinutes, useData } from "@/components/data";
import type { Entry, Period } from "@/lib/edupage";

type Phase = "past" | "now" | "next" | "future";

export default function TodayBoard() {
  const { data, teacherById } = useData();
  const router = useRouter();
  const [now, setNow] = useState(() => tashkent());
  const isSunday = now.weekday > 5;
  const [day, setDay] = useState(() => (tashkent().weekday > 5 ? 0 : tashkent().weekday));
  const [period, setPeriod] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // Eski havolalar: /#t=*165 → /teachers/165
  useEffect(() => {
    const t = new URLSearchParams(location.hash.slice(1)).get("t");
    if (t) router.replace(`/teachers/${teacherSlug(t)}`);
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setNow(tashkent()), 30_000);
    return () => clearInterval(id);
  }, []);

  const periods = data!.periods;
  const isToday = day === now.weekday;
  const dayEntries = useMemo(() => data!.entries.filter((e) => e.day === day), [data, day]);

  // Har bir para holati (faqat bugungi kun uchun "hozir"/"keyingi")
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

  const teachersToday = new Set(dayEntries.flatMap((e) => e.teacherIds)).size;
  const roomsToday = new Set(dayEntries.flatMap((e) => e.rooms)).size;

  return (
    <div className="board">
      <header className="board-head">
        <div>
          <h1 className="display">{isToday ? now.label : DAY_NAMES[day]}</h1>
          <p className="lede">{statusLine(isToday, isSunday, periods, phases, counts, day)}</p>
        </div>
        <dl className="board-stats">
          <div><dt>dars</dt><dd>{fmt(dayEntries.length)}</dd></div>
          <div><dt>o&apos;qituvchi</dt><dd>{fmt(teachersToday)}</dd></div>
          <div><dt>xona</dt><dd>{fmt(roomsToday)}</dd></div>
        </dl>
      </header>

      <div className="daybar" role="tablist" aria-label="Hafta kuni">
        {Array.from({ length: data!.dayCount }, (_, d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === day}
            className={"day-tab" + (d === now.weekday ? " is-today" : "")}
            onClick={() => { setDay(d); setPeriod(null); }}
          >
            <span className="day-short">{DAY_SHORT[d]}</span>
            <span className="day-long">{DAY_NAMES[d]}</span>
          </button>
        ))}
      </div>

      <Rail periods={periods} phases={phases} counts={counts} selected={period} onSelect={setPeriod} now={isToday ? now.minutes : null} />

      <div className="board-tools">
        <input
          className="field"
          type="search"
          placeholder="Fan, o'qituvchi, guruh yoki xona"
          aria-label="Darslar ichida qidirish"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {period !== null && (
          <button className="chip" onClick={() => setPeriod(null)}>
            {period}-para <span aria-hidden="true">×</span>
            <span className="sr-only">filtrini olib tashlash</span>
          </button>
        )}
        <span className="muted tabular">{fmt(rows.length)} ta dars</span>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-inline">
          {dayEntries.length ? "Bu filtr bo'yicha dars topilmadi." : `${DAY_NAMES[day]} kuni dars yo'q.`}
        </div>
      ) : (
        grouped.map(([p, list]) => {
          const meta = periods.find((x) => x.period === p);
          const phase = phases[periods.findIndex((x) => x.period === p)];
          return (
            <section key={p} className={"slot-group phase-" + phase} aria-labelledby={`slot-${p}`}>
              <h2 id={`slot-${p}`} className="slot-head">
                <span className="slot-num">{p}</span>
                <span className="slot-time tabular">{meta?.starttime}–{meta?.endtime}</span>
                {phase === "now" && <span className="live">hozir</span>}
                <span className="slot-count muted">{list.length} dars</span>
              </h2>
              <ul className="lesson-rows">
                {list.map((e) => (
                  <li key={e.id} className="lesson-row" style={{ ["--c" as string]: e.color }}>
                    <span className="lr-subject">
                      {e.subject}
                      {e.duration > 1 && <span className="lr-span">{e.duration} para</span>}
                    </span>
                    <span className="lr-teachers">
                      {e.teacherIds.length ? e.teacherIds.map((id, i) => (
                        <Link key={id} href={`/teachers/${teacherSlug(id)}`}>
                          <span className="swatch" style={{ ["--c" as string]: teacherById.get(id)?.color }} />
                          {e.teachers[i]}
                        </Link>
                      )) : <span className="muted">—</span>}
                    </span>
                    <span className="lr-groups">{groupsOf(e) || "—"}</span>
                    <span className="lr-room">{e.rooms.join(", ") || "—"}</span>
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

function statusLine(isToday: boolean, isSunday: boolean, periods: Period[], phases: Phase[], counts: Map<number, number>, day: number) {
  if (!isToday) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return isSunday && day === 0
      ? `Bugun yakshanba, dars yo'q. Dushanba jadvali ko'rsatilmoqda: ${fmt(total)} ta dars.`
      : `${DAY_NAMES[day]} jadvali: ${periods.length} para, ${fmt(total)} ta dars.`;
  }
  const nowIdx = phases.indexOf("now");
  if (nowIdx >= 0) {
    const p = periods[nowIdx];
    return `Hozir ${p.period}-para davom etyapti, ${p.endtime} gacha. ${fmt(counts.get(p.period) || 0)} ta dars o'tilmoqda.`;
  }
  const nextIdx = phases.indexOf("next");
  if (nextIdx >= 0) return `Keyingi: ${periods[nextIdx].period}-para, ${periods[nextIdx].starttime} da boshlanadi.`;
  return "Bugungi darslar tugadi.";
}

// Paralar chizig'i: kun bo'ylab "bekatlar", hozirgi para signal rangida
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
                aria-label={`${p.period}-para, ${p.starttime}–${p.endtime}, ${n} dars`}
              >
                <span className="stop-dot" aria-hidden="true" />
                <span className="stop-num">{p.period}</span>
                <span className="stop-time tabular">{p.starttime}–{p.endtime}</span>
                <span className="stop-load" aria-hidden="true"><span style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="stop-count tabular">{fmt(n)} dars</span>
              </button>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
