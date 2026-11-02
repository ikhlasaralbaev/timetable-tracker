"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Entry, FetchInfo, Teacher, Timetable } from "@/lib/edupage";
import { BotSettings, TeacherBot, type AdminState } from "@/components/AdminPanels";

const DAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const PAGE_SIZE = 300;

type Data = Timetable & { info: FetchInfo };
type View = "week" | "table";
type SortKey = "day" | "subject" | "teacher" | "group" | "room";

const SORTERS: Record<SortKey, (a: Entry, b: Entry) => number> = {
  day: (a, b) => a.day - b.day || a.period - b.period || a.subject.localeCompare(b.subject),
  subject: (a, b) => a.subject.localeCompare(b.subject) || SORTERS.day(a, b),
  teacher: (a, b) => (a.teachers[0] || "").localeCompare(b.teachers[0] || "") || SORTERS.day(a, b),
  group: (a, b) => (a.classes[0] || "").localeCompare(b.classes[0] || "") || SORTERS.day(a, b),
  room: (a, b) => (a.rooms[0] || "").localeCompare(b.rooms[0] || "") || SORTERS.day(a, b),
};

const COLUMNS: [SortKey, string][] = [
  ["day", "Kun / para"],
  ["subject", "Fan"],
  ["teacher", "O'qituvchi"],
  ["group", "Guruh"],
  ["room", "Xona"],
];

const fmt = (n: number) => n.toLocaleString("uz");

export default function TimetableApp() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [view, setView] = useState<View>("week");
  const [day, setDay] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "day", dir: 1 });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [admin, setAdmin] = useState<AdminState | null>(null);

  const loadAdmin = useCallback(async () => {
    const res = await fetch("/api/admin/state", { cache: "no-store" });
    if (res.ok) setAdmin(await res.json());
  }, []);

  const load = useCallback(async (refresh = false) => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/timetable" + (refresh ? "?refresh=1" : ""), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server ${res.status} javob qaytardi`);
      setData(json);
      setError(null);
    } catch (e) {
      if (refresh) alert("Yangilab bo'lmadi: " + (e as Error).message);
      else setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const syncHash = () => setTeacherId(new URLSearchParams(location.hash.slice(1)).get("t"));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    load();
    loadAdmin();
    return () => window.removeEventListener("hashchange", syncHash);
  }, [load, loadAdmin]);

  const linked = useMemo(() => new Set((admin?.subscribers || []).map((s) => s.teacher_id)), [admin]);

  const teacherById = useMemo(() => new Map((data?.teachers || []).map((t) => [t.id, t])), [data]);
  const teacher = teacherId ? teacherById.get(teacherId) ?? null : null;

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.toLowerCase();
    return data.entries.filter((e) => {
      if (teacher && !e.teacherIds.includes(teacher.id)) return false;
      if (day !== "" && e.day !== Number(day)) return false;
      if (needle) {
        const hay = [e.subject, ...e.teachers, ...e.classes, ...e.groups, ...e.rooms].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, teacher, day, q]);

  function selectTeacher(id: string | null) {
    setTeacherId(id);
    setLimit(PAGE_SIZE);
    history.replaceState(null, "", id ? "#t=" + encodeURIComponent(id) : location.pathname);
    document.querySelector("main")?.scrollIntoView({ block: "start" });
  }

  if (!data) {
    return (
      <div className="app">
        <Sidebar data={null} teacherId={null} query="" onQuery={() => {}} onSelect={() => {}} />
        <main>
          {error ? (
            <div className="state error">
              <h2>Jadvalni yuklab bo&apos;lmadi</h2>
              <p>{error}</p>
              <p>
                Tafsilotlar uchun <code>/api/check</code> sahifasini oching.
              </p>
              <button className="btn" onClick={() => { setError(null); load(); }}>Qayta urinish</button>
            </div>
          ) : (
            <div className="state">
              <div className="spinner" aria-hidden="true" />
              <h2>Jadval yuklanmoqda</h2>
              <p>edupage&apos;dan ~3 MB ma&apos;lumot olinmoqda.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const weekAllowed = !!teacher;
  const activeView: View = weekAllowed ? view : "table";
  const hours = rows.reduce((s, e) => s + e.duration, 0);

  return (
    <div className="app">
      <Sidebar data={data} teacherId={teacher?.id ?? null} query={teacherQuery} onQuery={setTeacherQuery} onSelect={selectTeacher} linked={linked} />

      <main>
        <section>
          <div className="page-head">
            <div>
              <h2>
                {teacher && <span className="tdot" style={{ ["--c" as string]: teacher.color }} />}
                {teacher ? teacher.name : "Barcha darslar"}
              </h2>
              <p className="sub">
                {teacher ? "Haftalik dars jadvali" : "O'qituvchini chapdagi ro'yxatdan tanlang yoki barcha darslarni ko'ring"}
              </p>
            </div>
            <div className="actions">
              <button className="btn" disabled={refreshing} onClick={() => load(true)}>Yangilash</button>
            </div>
          </div>

          {teacher
            ? <TeacherBot teacherId={teacher.id} state={admin} onChange={loadAdmin} />
            : <BotSettings state={admin} onChange={loadAdmin} />}

          <ul className="stats">
            {([
              [rows.length, "dars"],
              [hours, "para"],
              [new Set(rows.map((e) => e.day)).size, "kun"],
              [new Set(rows.flatMap((e) => e.classes)).size, "guruh"],
            ] as const).map(([v, l]) => (
              <li key={l}><b>{fmt(v)}</b><span>{l}</span></li>
            ))}
          </ul>

          <div className="toolbar">
            {weekAllowed && (
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={activeView === "week"} onClick={() => setView("week")}>Hafta</button>
                <button role="tab" aria-selected={activeView === "table"} onClick={() => setView("table")}>Ro&apos;yxat</button>
              </div>
            )}
            <select aria-label="Kun bo'yicha filter" value={day} onChange={(e) => { setDay(e.target.value); setLimit(PAGE_SIZE); }}>
              <option value="">Barcha kunlar</option>
              {Array.from({ length: data.dayCount }, (_, d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
            </select>
            <input
              type="search"
              placeholder="Fan, guruh yoki xona"
              aria-label="Darslar ichida qidirish"
              value={q}
              onChange={(e) => { setQ(e.target.value.trim()); setLimit(PAGE_SIZE); }}
            />
            <span className="result-count">{fmt(rows.length)} ta natija</span>
          </div>

          {activeView === "week" ? (
            <WeekGrid data={data} rows={rows} day={day} teacherId={teacher?.id ?? null} />
          ) : (
            <LessonTable
              rows={rows}
              sort={sort}
              onSort={(key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
              limit={limit}
              onMore={() => setLimit((l) => l + PAGE_SIZE)}
              teacherById={teacherById}
              onTeacher={selectTeacher}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function Sidebar({ data, teacherId, query, onQuery, onSelect, linked }: {
  data: Data | null;
  linked?: Set<string>;
  teacherId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const needle = query.trim().toLowerCase();
  const list = (data?.teachers || []).filter((t) => !needle || t.name.toLowerCase().includes(needle));
  const meta = data
    ? `${data.teachers.length} o'qituvchi, ${fmt(data.entries.length)} dars · ${new Date(data.loadedAt).toLocaleTimeString("uz", { hour: "2-digit", minute: "2-digit" })}`
    : "Ma'lumot yuklanmoqda…";

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>EMU dars jadvali</h1>
        <p>{meta}</p>
      </div>
      <div className="search">
        <input
          type="search"
          placeholder="O'qituvchini qidirish"
          aria-label="O'qituvchini qidirish"
          autoComplete="off"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <ul className="teacher-list" aria-label="O'qituvchilar">
        {data && !needle && (
          <li className="all-btn">
            <button aria-current={!teacherId} onClick={() => onSelect(null)}>
              <span>Barcha o&apos;qituvchilar</span><span className="count">{data.entries.length}</span>
            </button>
          </li>
        )}
        {list.map((t) => (
          <li key={t.id}>
            <button aria-current={t.id === teacherId} className={t.count ? "" : "empty-teacher"} onClick={() => onSelect(t.id)}>
              <span className="name"><span className="tdot" style={{ ["--c" as string]: t.color }} />{t.name}</span>
              <span className="count">
                {linked?.has(t.id) && <span className="tg" title="Telegram'ga ulangan">TG</span>}
                {t.count}
              </span>
            </button>
          </li>
        ))}
        {data && !list.length && <li className="empty-note">Hech kim topilmadi</li>}
      </ul>
    </aside>
  );
}

function WeekGrid({ data, rows, day, teacherId }: { data: Data; rows: Entry[]; day: string; teacherId: string | null }) {
  const { periods, dayCount } = data;
  const days = Array.from({ length: dayCount }, (_, d) => d).filter((d) => day === "" || d === Number(day));
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="week-wrap">
      <div className="week" style={{ ["--periods" as string]: periods.length }}>
        <div className="hd" />
        {periods.map((p) => (
          <div className="hd" key={p.period}><b>{p.name}-para</b>{p.starttime}–{p.endtime}</div>
        ))}

        {days.map((d, i) => {
          const dayRows = rows.filter((e) => e.day === d);
          const cls = (i ? "row-line" : "") + (d === todayIdx ? " today" : "");
          // Har bir para uchun katak; ko'p paralik darslar span bilan cho'ziladi
          const slots: React.ReactNode[] = [];
          for (let p = 0; p < periods.length;) {
            const here = dayRows.filter((e) => e.period === periods[p].period);
            const span = Math.min(Math.max(1, ...here.map((e) => e.duration)), periods.length - p);
            slots.push(
              <div key={d + ":" + p} className={"slot " + cls} style={{ gridColumn: `span ${span}` }}>
                {here.map((e) => <LessonCard key={e.id} e={e} teacherId={teacherId} />)}
              </div>,
            );
            p += span;
          }
          return [
            <div key={"d" + d} className={"day " + cls}>
              {DAY_NAMES[d]}
              <small>{dayRows.length ? dayRows.length + " dars" : "bo'sh"}</small>
            </div>,
            ...slots,
          ];
        })}
      </div>
    </div>
  );
}

function LessonCard({ e, teacherId }: { e: Entry; teacherId: string | null }) {
  const who = [...e.classes, ...e.groups].join(", ");
  const others = e.teacherIds.length > 1 ? e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId) : [];
  return (
    <div className="lesson" style={{ ["--c" as string]: e.color }}>
      <div className="subj">{e.subject}</div>
      {who && <div className="meta">{who}</div>}
      {others.length > 0 && <div className="meta">+ {others.join(", ")}</div>}
      {e.rooms.length > 0 && <div className="room">{e.rooms.join(", ")}</div>}
    </div>
  );
}

function LessonTable({ rows, sort, onSort, limit, onMore, teacherById, onTeacher }: {
  rows: Entry[];
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  limit: number;
  onMore: () => void;
  teacherById: Map<string, Teacher>;
  onTeacher: (id: string) => void;
}) {
  const sorted = useMemo(() => rows.slice().sort((a, b) => SORTERS[sort.key](a, b) * sort.dir), [rows, sort]);
  const shown = sorted.slice(0, limit);

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map(([k, label]) => (
                <th key={k} aria-sort={k === sort.key ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                  <button onClick={() => onSort(k)}>{label}{k === sort.key ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((e) => (
              <tr key={e.id}>
                <td className="num">
                  {DAY_NAMES[e.day]}, {e.period}{e.duration > 1 ? "–" + (e.period + e.duration - 1) : ""}-para
                  <br /><span style={{ color: "var(--muted)" }}>{e.start}–{e.end}</span>
                </td>
                <td><span className="dot" style={{ background: e.color }} />{e.subject}</td>
                <td>
                  {e.teacherIds.length ? e.teacherIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <a onClick={() => onTeacher(id)}>
                        <span className="tdot" style={{ ["--c" as string]: teacherById.get(id)?.color }} />
                        {e.teachers[i]}
                      </a>
                    </span>
                  )) : "—"}
                </td>
                <td>{[...e.classes, ...e.groups].join(", ") || "—"}</td>
                <td>{e.rooms.join(", ") || "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty-note">Bu filterlar bo&apos;yicha dars topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="more">
          <button className="btn" onClick={onMore}>Yana {Math.min(PAGE_SIZE, sorted.length - limit)} ta ko&apos;rsatish</button>
        </div>
      )}
    </div>
  );
}
