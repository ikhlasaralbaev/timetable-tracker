// Telegram webhook'ni shu saytga ulash va bot buyruqlarini ro'yxatdan o'tkazish
import { tg } from "@/lib/telegram";
import { errorResponse } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const url = `${new URL(req.url).origin}/api/telegram`;
    await tg("setWebhook", {
      url,
      allowed_updates: ["message"],
      drop_pending_updates: true,
      ...(process.env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET } : {}),
    });
    await tg("setMyCommands", {
      commands: [
        { command: "bugun", description: "Bugungi darslar" },
        { command: "ertaga", description: "Ertangi darslar" },
        { command: "stop", description: "Xabarlarni to'xtatish" },
      ],
    });
    return Response.json({ ok: true, url });
  } catch (err) {
    return errorResponse(err);
  }
}
