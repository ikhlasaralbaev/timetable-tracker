// Admin panel va admin API'ni parol bilan yopadi.
// Ochiq qoladi: /login, /api/login, Telegram webhook, cron va diagnostika (ular o'z kalitlari bilan himoyalangan).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authDisabled, verifySession } from "@/lib/session";

export async function proxy(req: NextRequest) {
  if (authDisabled()) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD;
  if (password && (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, password))) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Kirish talab qilinadi" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/login|api/telegram|api/cron|api/check|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
