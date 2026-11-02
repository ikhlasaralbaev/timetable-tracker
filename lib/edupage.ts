// Edupage jadvalini olish va parse qilish. Server tomonida ishlaydi
// (API route'lar, keyinchalik Telegram bot ham shu modulni ishlatadi).

const EDUPAGE_URL = "https://emu.edupage.org/timetable/server/regulartt.js?__func=regularttGetData";
const TT_NUM = process.env.EDUPAGE_TT_NUM || "165";
const CACHE_MS = 10 * 60 * 1000;
// Edupage Vercel (AWS) IP'larini bloklaydi; productionda so'rov Cloudflare Worker orqali o'tadi (proxy/worker.js)
const PROXY_URL = process.env.EDUPAGE_PROXY_URL;
const PROXY_KEY = process.env.EDUPAGE_PROXY_KEY;

export type Entry = {
  id: string;
  day: number;
  period: number;
  duration: number;
  start: string;
  end: string;
  subject: string;
  color: string;
  teacherIds: string[];
  teachers: string[];
  classes: string[];
  groups: string[];
  rooms: string[];
};

export type Teacher = { id: string; name: string; color: string; count: number };
export type Period = { period: number; name: string; starttime: string; endtime: string };

export type Timetable = {
  entries: Entry[];
  teachers: Teacher[];
  periods: Period[];
  dayCount: number;
  loadedAt: string;
};

export type FetchInfo = { status: number; bytes: number; fetchMs: number; parseMs: number; cached: boolean };

type Row = Record<string, any>;

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

export async function fetchRaw(): Promise<{ json: unknown; status: number; bytes: number; fetchMs: number }> {
  const t0 = Date.now();
  const res = PROXY_URL
    ? await fetch(`${PROXY_URL}?tt=${encodeURIComponent(TT_NUM)}`, {
        headers: PROXY_KEY ? { "x-proxy-key": PROXY_KEY } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      })
    : await fetch(EDUPAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ __args: [null, TT_NUM], __gsh: "00000000" }),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
  const text = await res.text();
  const fetchMs = Date.now() - t0;
  if (!res.ok) throw new Error(`edupage ${res.status} javob qaytardi: ${text.slice(0, 200)}`);
  return { json: JSON.parse(text), status: res.status, bytes: text.length, fetchMs };
}

export function parse(json: any): Timetable {
  const raw: { id: string; data_rows: Row[] }[] | undefined = json?.r?.dbiAccessorRes?.tables;
  if (!raw) throw new Error("Javob formati kutilganidek emas (r.dbiAccessorRes.tables topilmadi)");
  const t: Record<string, Row[]> = Object.fromEntries(raw.map((x) => [x.id, x.data_rows || []]));
  const map = (name: string) => new Map<string, Row>((t[name] || []).map((r) => [r.id, r]));

  const subjects = map("subjects");
  const teachers = map("teachers");
  const classes = map("classes");
  const groups = map("groups");
  const rooms = map("classrooms");
  const lessons = map("lessons");
  const periods = new Map<number, Row>((t.periods || []).map((p) => [Number(p.period), p]));
  const dayCount = (t.days || []).length || 6;

  const entries: Entry[] = [];
  for (const card of t.cards || []) {
    if (!card.days || !card.period) continue; // joylashtirilmagan kartalar
    const lesson = lessons.get(card.lessonid);
    if (!lesson) continue;
    const period = Number(card.period);
    const duration: number = lesson.durationperiods || 1;
    const subject = subjects.get(lesson.subjectid);
    const teacherIds: string[] = lesson.teacherids || [];

    const classNames = (lesson.classids || []).map((id: string) => clean(classes.get(id)?.name)).filter(Boolean);
    const groupNames = (lesson.groupids || [])
      .map((id: string) => groups.get(id))
      .filter((g: Row | undefined) => g && !g.entireclass)
      .map((g: Row) => clean(g.name));

    for (let d = 0; d < card.days.length; d++) {
      if (card.days[d] !== "1") continue;
      entries.push({
        id: card.id + ":" + d,
        day: d,
        period,
        duration,
        start: periods.get(period)?.starttime || "",
        end: periods.get(period + duration - 1)?.endtime || periods.get(period)?.endtime || "",
        subject: clean(subject?.name) || "—",
        color: subject?.color || "#8899AA",
        teacherIds,
        teachers: teacherIds.map((id) => clean(teachers.get(id)?.name)).filter(Boolean),
        classes: classNames,
        groups: groupNames,
        rooms: (card.classroomids || []).map((id: string) => clean(rooms.get(id)?.name)).filter(Boolean),
      });
    }
  }

  const lessonCount = new Map<string, number>();
  for (const e of entries) for (const id of e.teacherIds) lessonCount.set(id, (lessonCount.get(id) || 0) + 1);

  const teacherList: Teacher[] = [...teachers.values()]
    .map((x) => ({ id: x.id, name: clean(x.name) || clean(x.short), color: x.color || "#8899AA", count: lessonCount.get(x.id) || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));

  const periodList: Period[] = [...periods.values()]
    .map((p) => ({ period: Number(p.period), name: String(p.name), starttime: p.starttime, endtime: p.endtime }))
    .sort((a, b) => a.period - b.period);

  return { entries, teachers: teacherList, periods: periodList, dayCount, loadedAt: new Date().toISOString() };
}

// Bir instance ichidagi xotira keshi (serverless'da instance qayta ishga tushsa, tozalanadi)
let cache: { at: number; data: Timetable; info: FetchInfo } | null = null;

export async function getTimetable(force = false): Promise<{ data: Timetable; info: FetchInfo }> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { data: cache.data, info: { ...cache.info, cached: true } };
  }
  const raw = await fetchRaw();
  const t0 = Date.now();
  const data = parse(raw.json);
  const info: FetchInfo = { status: raw.status, bytes: raw.bytes, fetchMs: raw.fetchMs, parseMs: Date.now() - t0, cached: false };
  cache = { at: Date.now(), data, info };
  return { data, info };
}
