// Kunlik yuborish. Tashqi cron (masalan cron-job.org) har 5 daqiqada chaqiradi:
//   GET /api/cron/send  sarlavha: Authorization: Bearer <CRON_SECRET>  (yoki ?key=<CRON_SECRET>)
// Toshkent vaqti bo'yicha sozlangan vaqt kelgan va bugun hali yuborilmagan bo'lsa, xabarlar jo'natiladi.
// ?dry=1 — yubormasdan nima ketishini ko'rsatadi, ?force=1 — vaqt va "bugun yuborilgan" tekshiruvini chetlab o'tadi.
import { claimSendDate, getSettings, logSend } from "@/lib/db";
import { sendDigest } from "@/lib/digest";
import { tashkentNow } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") || url.searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const dry = url.searchParams.has("dry");
  const force = url.searchParams.has("force");
  const settings = await getSettings();
  const now = tashkentNow();

  if (!force) {
    if (!settings.enabled) return Response.json({ status: "disabled", now });
    if (now.time < settings.send_time) return Response.json({ status: "not-yet", now, sendTime: settings.send_time });
    if (settings.last_sent_date === now.date) return Response.json({ status: "already-sent", now });
  }

  if (dry) return Response.json({ status: "dry-run", now, ...(await sendDigest({ which: settings.send_day, dryRun: true })) });

  // Bir nechta parallel chaqiruvdan faqat bittasi yuboradi
  if (!force && !(await claimSendDate(now.date))) return Response.json({ status: "already-sent", now });

  const result = await sendDigest({ which: settings.send_day });
  await logSend(result.target, result.sent, result.skipped, result.failed);
  return Response.json({ status: "sent", now, ...result });
}
