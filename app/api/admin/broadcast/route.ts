// Barcha ulangan chatlarga darslarni hozir yuborish (kunlik avtomatik yuborishga ta'sir qilmaydi)
import { logSend } from "@/lib/db";
import { sendDigest } from "@/lib/digest";
import { errorResponse } from "@/lib/api";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { which, includeEmpty } = await req.json();
    if (which !== "today" && which !== "tomorrow") return errorResponse(new Error("which: today yoki tomorrow"), 400);
    const result = await sendDigest({ which, includeEmpty: !!includeEmpty });
    await logSend(result.target, result.sent, result.skipped, result.failed);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
