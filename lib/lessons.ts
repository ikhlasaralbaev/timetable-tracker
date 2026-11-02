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

export function formatDay(teacherName: string, day: DayRef, which: "today" | "tomorrow", lessons: Entry[], teacherId: string) {
  const head = `<b>${which === "tomorrow" ? "Ertangi" : "Bugungi"} darslar</b> · ${day.label}\n${escapeHtml(teacherName)}`;
  if (!lessons.length) return `${head}\n\n${which === "tomorrow" ? "Ertaga" : "Bugun"} darsingiz yo'q.`;

  const blocks = lessons.map((e) => {
    const periods = e.duration > 1 ? `${e.period}–${e.period + e.duration - 1}` : String(e.period);
    const who = [...e.classes, ...e.groups].join(", ");
    const others = e.teachers.filter((_, i) => e.teacherIds[i] !== teacherId);
    const lines = [
      `<b>${periods}-para</b>  ${e.start}–${e.end}`,
      escapeHtml(e.subject),
      who && `Guruh: ${escapeHtml(who)}`,
      e.rooms.length ? `Xona: ${escapeHtml(e.rooms.join(", "))}` : "",
      others.length ? `Birga: ${escapeHtml(others.join(", "))}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  });
  return `${head}\n\n${blocks.join("\n\n")}`;
}
