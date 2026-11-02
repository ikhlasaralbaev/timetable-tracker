// Bitta o'qituvchiga darslarni hozir yuborish (tekshirish uchun)
import { sendDigest } from "@/lib/digest";
import { errorResponse } from "@/lib/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { teacherId, which } = await req.json();
    const result = await sendDigest({ which: which === "today" ? "today" : "tomorrow", teacherId, includeEmpty: true });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
