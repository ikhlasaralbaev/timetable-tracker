// Admin panel holati: sozlamalar, obunachilar, bot va DB holati
import { dbConfigured, getSettings, lastSends, listSubscribers } from "@/lib/db";
import { botConfigured, botUsername, tg } from "@/lib/telegram";
import { tashkentNow } from "@/lib/lessons";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    db: dbConfigured(),
    bot: botConfigured(),
    cron: !!process.env.CRON_SECRET,
    now: tashkentNow(),
  };
  try {
    const [settings, subscribers, sends] = status.db
      ? await Promise.all([getSettings(), listSubscribers(), lastSends()])
      : [null, [], []];
    let bot: { username: string; webhookUrl: string; pending: number; lastError: string | null } | null = null;
    if (status.bot) {
      const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo");
      bot = { username: await botUsername(), webhookUrl: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null };
    }
    return Response.json({ status, settings, subscribers, sends, bot });
  } catch (err) {
    return errorResponse(err);
  }
}
