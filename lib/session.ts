// Admin sessiyasi: HMAC bilan imzolangan cookie. Kalit ADMIN_PASSWORD'dan olinadi,
// shuning uchun parol o'zgarsa, barcha eski sessiyalar bekor bo'ladi.
// Web Crypto ishlatiladi, chunki proxy.ts ham shu modulni chaqiradi.

export const SESSION_COOKIE = "admin_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function sign(value: string, password: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode("timetable:" + password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(password: string) {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${exp}.${await sign(exp, password)}`;
}

export async function verifySession(cookie: string | undefined, password: string) {
  if (!cookie) return false;
  const [exp, sig] = cookie.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await sign(exp, password);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// Lokal ishlab chiqishda parol o'rnatilmagan bo'lsa, himoya o'chiq
export const authDisabled = () => !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
