// O'qituvchi uchun bir martalik Telegram havola yaratish
import { createInvite } from "@/lib/db";
import { botUsername } from "@/lib/telegram";
import { errorResponse } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { teacherId } = await req.json();
    if (!teacherId || typeof teacherId !== "string") return errorResponse(new Error("teacherId kerak"), 400);
    const [{ token, expiresAt }, username] = await Promise.all([createInvite(teacherId), botUsername()]);
    return Response.json({ link: `https://t.me/${username}?start=${token}`, expiresAt });
  } catch (err) {
    return errorResponse(err);
  }
}
