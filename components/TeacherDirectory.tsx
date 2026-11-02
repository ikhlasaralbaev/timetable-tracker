"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DAY_NAMES, DAY_SHORT, fmt, teacherSlug, useData } from "@/components/data";

type Filter = "all" | "linked" | "unlinked" | "idle";
type Sort = "name" | "load";

const FILTERS: [Filter, string][] = [
  ["all", "Hammasi"],
  ["linked", "Telegram'ga ulangan"],
  ["unlinked", "Ulanmagan"],
  ["idle", "Darsi yo'q"],
];

export default function TeacherDirectory() {
  const { data, linked } = useData();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");

  // O'qituvchi → kunlar bo'yicha darslar soni
  const perDay = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const e of data!.entries) {
      for (const id of e.teacherIds) {
        const row = m.get(id) || Array(data!.dayCount).fill(0);
        row[e.day]++;
        m.set(id, row);
      }
    }
    return m;
  }, [data]);

  const counts: Record<Filter, number> = {
    all: data!.teachers.length,
    linked: data!.teachers.filter((t) => linked.has(t.id)).length,
    unlinked: data!.teachers.filter((t) => t.count > 0 && !linked.has(t.id)).length,
    idle: data!.teachers.filter((t) => t.count === 0).length,
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data!.teachers
      .filter((t) => !needle || t.name.toLowerCase().includes(needle))
      .filter((t) =>
        filter === "linked" ? linked.has(t.id)
        : filter === "unlinked" ? t.count > 0 && !linked.has(t.id)
        : filter === "idle" ? t.count === 0
        : true)
      .sort((a, b) => (sort === "load" ? b.count - a.count : 0) || a.name.localeCompare(b.name, "uz"));
  }, [data, q, filter, sort, linked]);

  const peak = Math.max(1, ...[...perDay.values()].flat());

  return (
    <div className="directory">
      <header className="page-head">
        <h1 className="display">O&apos;qituvchilar</h1>
        <p className="lede">
          {fmt(counts.all)} nafar o&apos;qituvchi, ulardan {fmt(counts.linked)} nafari Telegram&apos;ga ulangan.
          Havola yaratish uchun o&apos;qituvchini oching.
        </p>
      </header>

      <div className="dir-tools">
        <input
          className="field"
          type="search"
          placeholder="Ism bo'yicha qidirish"
          aria-label="Ism bo'yicha qidirish"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="segmented" role="radiogroup" aria-label="Saralash">
          <button role="radio" aria-checked={sort === "name"} onClick={() => setSort("name")}>A–Z</button>
          <button role="radio" aria-checked={sort === "load"} onClick={() => setSort("load")}>Yuklama</button>
        </div>
      </div>

      <div className="filter-row" role="radiogroup" aria-label="Filtr">
        {FILTERS.map(([key, label]) => (
          <button key={key} role="radio" aria-checked={filter === key} className="chip" onClick={() => setFilter(key)}>
            {label} <span className="chip-count tabular">{fmt(counts[key])}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty-inline">Bu filtr bo&apos;yicha o&apos;qituvchi topilmadi.</div>
      ) : (
        <table className="dir-table">
          <thead>
            <tr>
              <th scope="col">O&apos;qituvchi</th>
              <th scope="col" className="hide-sm">
                <span className="heat heat-legend" aria-label="Kunlar bo'yicha darslar">
                  {Array.from({ length: data!.dayCount }, (_, d) => <span key={d}>{DAY_SHORT[d]}</span>)}
                </span>
              </th>
              <th scope="col" className="num">Dars</th>
              <th scope="col">Telegram</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const days = perDay.get(t.id) || Array(data!.dayCount).fill(0);
              return (
                <tr key={t.id} className={t.count ? "" : "is-idle"}>
                  <td>
                    <Link href={`/teachers/${teacherSlug(t.id)}`} className="dir-name">
                      <span className="swatch" style={{ ["--c" as string]: t.color }} />
                      {t.name}
                    </Link>
                  </td>
                  <td className="hide-sm">
                    <span className="heat" aria-label={days.map((n, d) => `${DAY_NAMES[d]}: ${n}`).join(", ")}>
                      {days.map((n, d) => (
                        <span key={d} className="heat-cell" style={{ ["--a" as string]: n ? 0.22 + (n / peak) * 0.78 : 0 }} title={`${DAY_NAMES[d]}: ${n} dars`} />
                      ))}
                    </span>
                  </td>
                  <td className="num tabular">{t.count}</td>
                  <td>
                    {linked.has(t.id)
                      ? <span className="status on">Ulangan</span>
                      : <span className="status">{t.count ? "Ulanmagan" : "—"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
