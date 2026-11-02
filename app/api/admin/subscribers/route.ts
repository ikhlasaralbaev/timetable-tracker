// O'qituvchidan Telegram chatni uzish
import { removeSubscriber } from "@/lib/db";
import { errorResponse } from "@/lib/api";

export async function DELETE(req: Request) {
  try {
    const { teacherId, chatId } = await req.json();
    await removeSubscriber(teacherId, chatId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
