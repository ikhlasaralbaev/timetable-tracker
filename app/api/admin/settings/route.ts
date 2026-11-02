// Yuborish vaqti va qaysi kun darslari yuborilishi
import { updateSettings } from "@/lib/db";
import { errorResponse } from "@/lib/api";

export async function PUT(req: Request) {
  try {
    const { send_time, send_day, enabled } = await req.json();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(send_time)) return errorResponse(new Error("Vaqt HH:MM formatida bo'lishi kerak"), 400);
    if (send_day !== "today" && send_day !== "tomorrow") return errorResponse(new Error("send_day: today yoki tomorrow"), 400);
    await updateSettings({ send_time, send_day, enabled: !!enabled });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
