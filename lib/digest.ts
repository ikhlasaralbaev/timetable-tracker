// Obunachilarga kunlik dars xabarini yuborish (cron va admin "Hozir yuborish" ishlatadi)

import { getTimetable } from "./edupage";
import { listSubscribers, removeSubscriber, type Subscriber } from "./db";
import { dayRef, formatDay, lessonsFor } from "./lessons";
import { sendMessage, TelegramError } from "./telegram";

export type DigestResult = { target: string; sent: number; skipped: number; failed: number; errors: string[] };

export async function sendDigest(opts: {
  which: "today" | "tomorrow";
  teacherId?: string;     // faqat bitta o'qituvchiga
  includeEmpty?: boolean; // darsi yo'q kunda ham xabar yuborish
  dryRun?: boolean;       // yubormasdan matnni qaytarish
}): Promise<DigestResult & { preview?: { teacher: string; chat: string; text: string }[] }> {
  const { data } = await getTimetable();
  const day = dayRef(opts.which);
  const names = new Map(data.teachers.map((t) => [t.id, t.name]));

  let subs: Subscriber[] = await listSubscribers();
  if (opts.teacherId) subs = subs.filter((s) => s.teacher_id === opts.teacherId);

  const result: DigestResult = { target: day.date, sent: 0, skipped: 0, failed: 0, errors: [] };
  const preview: { teacher: string; chat: string; text: string }[] = [];

  for (const s of subs) {
    const lessons = lessonsFor(data, s.teacher_id, day.weekday);
    if (!lessons.length && !opts.includeEmpty) {
      result.skipped++;
      continue;
    }
    const text = formatDay(names.get(s.teacher_id) || s.teacher_id, day, opts.which, lessons, s.teacher_id);
    if (opts.dryRun) {
      preview.push({ teacher: s.teacher_id, chat: s.chat_id, text });
      continue;
    }
    try {
      await sendMessage(s.chat_id, text);
      result.sent++;
    } catch (err) {
      result.failed++;
      result.errors.push(`${s.teacher_id}/${s.chat_id}: ${(err as Error).message}`);
      // Foydalanuvchi botni bloklagan yoki chat o'chirilgan: obunani olib tashlaymiz
      if (err instanceof TelegramError && err.code === 403) await removeSubscriber(s.teacher_id, s.chat_id);
    }
    await new Promise((r) => setTimeout(r, 40)); // Telegram limiti: ~30 xabar/sek
  }

  return opts.dryRun ? { ...result, preview } : result;
}
