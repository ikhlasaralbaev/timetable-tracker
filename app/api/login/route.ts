import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, createSession } from "@/lib/session";

const hash = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return Response.json({ error: "Serverda ADMIN_PASSWORD o'rnatilmagan" }, { status: 500 });

  const { password: given } = await req.json().catch(() => ({ password: "" }));
  if (typeof given !== "string" || !timingSafeEqual(hash(given), hash(password))) {
    return Response.json({ error: "Parol noto'g'ri" }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, await createSession(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return Response.json({ ok: true });
}
