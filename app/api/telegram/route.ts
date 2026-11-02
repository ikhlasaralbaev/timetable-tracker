// Telegram webhook: /start <token>, /bugun, /ertaga, /stop
import { getTimetable } from "@/lib/edupage";
import { redeemInvite, removeChat, teacherIdsForChat, getSettings } from "@/lib/db";
import { dayRef, formatDay, lessonsFor } from "@/lib/lessons";
import { escapeHtml, sendMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Update = {
  message?: { text?: string; chat: { id: number; type: string; username?: string; first_name?: string } };
};

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  const update = (await req.json()) as Update;
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });

  try {
    await handle(msg.text.trim(), msg.chat);
  } catch (err) {
    console.error("telegram webhook", err);
    await sendMessage(msg.chat.id, "Xatolik yuz berdi, birozdan keyin qayta urinib ko'ring.").catch(() => {});
  }
  // Telegram qayta yubormasligi uchun har doim 200
  return Response.json({ ok: true });
}

async function handle(text: string, chat: NonNullable<Update["message"]>["chat"]) {
  const [command, arg] = text.split(/\s+/, 2);

  if (command === "/start") {
    if (!arg) {
      return sendMessage(chat.id, "Bu bot EMU dars jadvalini yuboradi. Ulanish uchun admin yuborgan havola orqali kiring.");
    }
    const teacherId = await redeemInvite(arg, chat);
    if (!teacherId) {
      return sendMessage(chat.id, "Havola eskirgan yoki allaqachon ishlatilgan. Admindan yangi havola so'rang.");
    }
    const [{ data }, settings] = await Promise.all([getTimetable(), getSettings()]);
    const name = data.teachers.find((t) => t.id === teacherId)?.name || teacherId;
    const when = settings.send_day === "tomorrow" ? "ertangi" : "bugungi";
    return sendMessage(
      chat.id,
      `Ulandingiz: <b>${escapeHtml(name)}</b>\n\nHar kuni ${settings.send_time} da ${when} darslaringiz yuboriladi.\n\n/bugun — bugungi darslar\n/ertaga — ertangi darslar\n/stop — xabarlarni to'xtatish`,
    );
  }

  if (command === "/bugun" || command === "/ertaga") {
    const which = command === "/bugun" ? "today" : "tomorrow";
    const ids = await teacherIdsForChat(chat.id);
    if (!ids.length) return sendMessage(chat.id, "Siz hali hech qaysi o'qituvchiga ulanmagansiz. Admin yuborgan havola orqali kiring.");
    const { data } = await getTimetable();
    const day = dayRef(which);
    for (const id of ids) {
      const name = data.teachers.find((t) => t.id === id)?.name || id;
      await sendMessage(chat.id, formatDay(name, day, which, lessonsFor(data, id, day.weekday), id));
    }
    return;
  }

  if (command === "/stop") {
    const n = await removeChat(chat.id);
    return sendMessage(chat.id, n ? "Xabarlar to'xtatildi. Qayta ulanish uchun admindan yangi havola so'rang." : "Siz hech qaysi o'qituvchiga ulanmagansiz.");
  }

  return sendMessage(chat.id, "/bugun — bugungi darslar\n/ertaga — ertangi darslar\n/stop — xabarlarni to'xtatish");
}
