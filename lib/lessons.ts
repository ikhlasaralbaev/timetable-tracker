// O'qituvchining bir kunlik darslarini topish va Telegram xabariga aylantirish

import type { Entry, Timetable } from "./edupage";
import { escapeHtml } from "./telegram";

export const DAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

// O'zbekistonda yozgi vaqt yo'q: doimo UTC+5
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type DayRef = { date: string; weekday: number; label: string };

export function tashkentNow() {
  const d = new Date(Date.now() + TASHKENT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

// "today" yoki "tomorrow" uchun sana va hafta kuni (0 = Dushanba)
export function dayRef(which: "today" | "tomorrow"): DayRef {
  const d = new Date(Date.now() + TASHKENT_OFFSET_MS + (which === "tomorrow" ? 86_400_000 : 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekday = (d.getUTCDay() + 6) % 7;
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    weekday,
    label: `${DAY_NAMES[weekday]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`,
  };
}

export function lessonsFor(data: Timetable, teacherId: string, weekday: number): Entry[] {
  return data.entries
    .filter((e) => e.day === weekday && e.teacherIds.includes(teacherId))
    .sort((a, b) => a.period - b.period);
}

// Para raqami uchun emoji-raqamlar: 1️⃣ 2️⃣ …
const KEYCAPS = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const keycap = (n: number) => KEYCAPS[n] ?? `${n}.`;

// Telegram HTML: har bir dars alohida <blockquote>, oxirida kun xulosasi
export function formatDay(teacherName: string, day: DayRef, which: "today" | "tomorrow", lessons: Entry[], teacherId: string) {
  const title = which === "tomorrow" ? "Ertangi darslar" : "Bugungi darslar";
  const head = `📅 <b>${title}</b>\n<i>${day.label}</i>\n👤 ${escapeHtml(teacherName)}`;

  if (!lessons.length) {
    return `${head}\n\n🌿 ${which === "tomorrow" ? "Ertaga" : "Bugun"} darsingiz yo'q. Yaxshi dam oling.`;
  }

  const blocks = lessons.map((e) => {
    const para = e.duration > 1 ? `${keycap(e.period)}–${keycap(e.period + e.duration - 1)}` : keycap(e.period);
    const groups = [...e.classes, ...e.groups].join(", ");
    const others = e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId);
    const lines = [
      `${para}  <b>${e.start} – ${e.end}</b>`,
      `📘 <b>${escapeHtml(e.subject)}</b>`,
      groups && `👥 ${escapeHtml(groups)}`,
      e.rooms.length ? `🚪 ${escapeHtml(e.rooms.join(", "))}` : "",
      others.length ? `🤝 Birga: ${escapeHtml(others.join(", "))}` : "",
    ];
    return `<blockquote>${lines.filter(Boolean).join("\n")}</blockquote>`;
  });

  const paras = lessons.reduce((n, e) => n + e.duration, 0);
  const first = lessons[0];
  const last = lessons[lessons.length - 1];
  const parasNote = paras !== lessons.length ? ` (${paras} para)` : "";
  const summary = `🕘 Jami <b>${lessons.length} ta dars</b>${parasNote}, ${first.start} dan ${last.end} gacha.`;

  return `${head}\n\n${blocks.join("\n")}\n${summary}`;
}
