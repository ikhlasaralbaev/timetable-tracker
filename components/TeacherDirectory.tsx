"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, DAY_NAMES, DAY_SHORT, fmt, teacherSlug, useData } from "@/components/data";
import { IconChevron, IconSearch } from "@/components/icons";

type Filter = "all" | "linked" | "unlinked" | "idle";
type Sort = "name" | "load";

const FILTERS: [Filter, string][] = [
  ["all", "Hammasi"],
  ["linked", "Ulangan"],
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
  const coverage = counts.all - counts.idle ? Math.round((counts.linked / (counts.all - counts.idle)) * 100) : 0;

  return (
    <div className="directory stagger">
      <header className="page-hero">
        <div>
          <h1 className="display">O&apos;qituvchilar</h1>
          <p className="lede">Havola yaratish va haftalik jadvalni ko&apos;rish uchun o&apos;qituvchini oching.</p>
        </div>
        <div className="coverage" aria-label={`Darsi bor o'qituvchilarning ${coverage} foizi Telegram'ga ulangan`}>
          <div className="coverage-ring" style={{ ["--p" as string]: coverage }}><span>{coverage}%</span></div>
          <div>
            <b>{fmt(counts.linked)} / {fmt(counts.all - counts.idle)}</b>
            <span className="muted">Telegram&apos;ga ulangan</span>
          </div>
        </div>
      </header>

      <div className="toolbar-sticky">
        <div className="dir-tools">
          <label className="field-icon">
            <IconSearch />
            <input type="search" placeholder="Ism bo'yicha qidirish" aria-label="Ism bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
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
      </div>

      {list.length === 0 ? (
        <div className="empty-inline">Bu filtr bo&apos;yicha o&apos;qituvchi topilmadi.</div>
      ) : (
        <ul className="people">
          <li className="people-head" aria-hidden="true">
            <span>O&apos;qituvchi</span>
            <span className="heat">{Array.from({ length: data!.dayCount }, (_, d) => <span key={d}>{DAY_SHORT[d]}</span>)}</span>
            <span>Telegram</span>
          </li>
          {list.map((t) => {
            const days = perDay.get(t.id) || Array(data!.dayCount).fill(0);
            const workDays = days.filter(Boolean).length;
            return (
              <li key={t.id}>
                <Link href={`/teachers/${teacherSlug(t.id)}`} className={"person-row" + (t.count ? "" : " is-idle")}>
                  <span className="person-main">
                    <Avatar name={t.name} color={t.color} />
                    <span className="person-text">
                      <b>{t.name}</b>
                      <span className="muted">{t.count ? `${t.count} dars · ${workDays} kun` : "Joriy jadvalda darsi yo'q"}</span>
                    </span>
                  </span>
                  <span className="heat" aria-label={days.map((n, d) => `${DAY_NAMES[d]}: ${n}`).join(", ")}>
                    {days.map((n, d) => (
                      <span key={d} className="heat-cell" style={{ ["--a" as string]: n ? 0.22 + (n / peak) * 0.78 : 0 }} title={`${DAY_NAMES[d]}: ${n} dars`} />
                    ))}
                  </span>
                  <span className="person-status">
                    {linked.has(t.id) ? <span className="status on">Ulangan</span> : <span className="status">{t.count ? "Ulanmagan" : "—"}</span>}
                    <IconChevron className="row-chevron" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
