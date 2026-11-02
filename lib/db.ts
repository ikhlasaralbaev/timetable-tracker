// Neon Postgres: taklif havolalari, obunachilar va bot sozlamalari.
// Jadvallar birinchi so'rovda avtomatik yaratiladi (CREATE TABLE IF NOT EXISTS).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

const INVITE_TTL_DAYS = 7;

export type Settings = {
  send_time: string; // "HH:MM", Toshkent vaqti
  send_day: "today" | "tomorrow";
  enabled: boolean;
  last_sent_date: string | null; // "YYYY-MM-DD"
};

export type Subscriber = {
  teacher_id: string;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  created_at: string;
};

export function dbConfigured() {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function client() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL o'rnatilmagan (Vercel → Storage → Neon)");
  return neon(url);
}

type Sql = NeonQueryFunction<false, false>;

let ready: Promise<Sql> | null = null;

async function db(): Promise<Sql> {
  ready ??= (async () => {
    const sql = client();
    await sql.query(`CREATE TABLE IF NOT EXISTS invites (
      token text PRIMARY KEY,
      teacher_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      used_by bigint
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS subscribers (
      teacher_id text NOT NULL,
      chat_id bigint NOT NULL,
      username text,
      first_name text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (teacher_id, chat_id)
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS settings (
      id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      send_time text NOT NULL DEFAULT '19:00',
      send_day text NOT NULL DEFAULT 'tomorrow',
      enabled boolean NOT NULL DEFAULT true,
      last_sent_date date
    )`);
    await sql.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING`);
    await sql.query(`CREATE TABLE IF NOT EXISTS send_log (
      id serial PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      target_date date,
      sent int NOT NULL,
      skipped int NOT NULL,
      failed int NOT NULL
    )`);
    return sql;
  })().catch((err) => {
    ready = null; // keyingi so'rovda qayta urinsin
    throw err;
  });
  return ready;
}

/* ---------- Taklif havolalari ---------- */

export async function createInvite(teacherId: string) {
  const sql = await db();
  // Telegram start parametri: faqat A-Z a-z 0-9 _ - (64 belgigacha)
  const token = randomBytes(16).toString("base64url");
  const rows = await sql.query(
    `INSERT INTO invites (token, teacher_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING expires_at`,
    [token, teacherId, INVITE_TTL_DAYS],
  );
  return { token, expiresAt: String(rows[0].expires_at) };
}

// Tokenni bir martalik ishlatadi; muvaffaqiyatli bo'lsa teacher_id qaytadi
export async function redeemInvite(token: string, chat: { id: number; username?: string; first_name?: string }) {
  const sql = await db();
  const rows = await sql.query(
    `UPDATE invites SET used_at = now(), used_by = $2
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING teacher_id`,
    [token, chat.id],
  );
  if (!rows.length) return null;
  const teacherId = String(rows[0].teacher_id);
  await sql.query(
    `INSERT INTO subscribers (teacher_id, chat_id, username, first_name) VALUES ($1, $2, $3, $4)
     ON CONFLICT (teacher_id, chat_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name`,
    [teacherId, chat.id, chat.username ?? null, chat.first_name ?? null],
  );
  return teacherId;
}

/* ---------- Obunachilar ---------- */

export async function listSubscribers(): Promise<Subscriber[]> {
  const sql = await db();
  const rows = await sql.query(
    `SELECT teacher_id, chat_id::text AS chat_id, username, first_name, created_at FROM subscribers ORDER BY created_at`,
  );
  return rows as Subscriber[];
}

export async function teacherIdsForChat(chatId: number): Promise<string[]> {
  const sql = await db();
  const rows = await sql.query(`SELECT teacher_id FROM subscribers WHERE chat_id = $1`, [chatId]);
  return rows.map((r) => String(r.teacher_id));
}

export async function removeSubscriber(teacherId: string, chatId: string | number) {
  const sql = await db();
  await sql.query(`DELETE FROM subscribers WHERE teacher_id = $1 AND chat_id = $2`, [teacherId, chatId]);
}

export async function removeChat(chatId: string | number) {
  const sql = await db();
  const rows = await sql.query(`DELETE FROM subscribers WHERE chat_id = $1 RETURNING teacher_id`, [chatId]);
  return rows.length;
}

/* ---------- Sozlamalar ---------- */

export async function getSettings(): Promise<Settings> {
  const sql = await db();
  const rows = await sql.query(
    `SELECT send_time, send_day, enabled, to_char(last_sent_date, 'YYYY-MM-DD') AS last_sent_date FROM settings WHERE id = 1`,
  );
  return rows[0] as Settings;
}

export async function updateSettings(s: Pick<Settings, "send_time" | "send_day" | "enabled">) {
  const sql = await db();
  await sql.query(`UPDATE settings SET send_time = $1, send_day = $2, enabled = $3 WHERE id = 1`, [s.send_time, s.send_day, s.enabled]);
}

// Bugungi yuborishni "band qiladi": bir kunda faqat bitta cron chaqiruvi true oladi
export async function claimSendDate(date: string) {
  const sql = await db();
  const rows = await sql.query(
    `UPDATE settings SET last_sent_date = $1::date
     WHERE id = 1 AND (last_sent_date IS NULL OR last_sent_date < $1::date)
     RETURNING id`,
    [date],
  );
  return rows.length > 0;
}

export async function logSend(targetDate: string, sent: number, skipped: number, failed: number) {
  const sql = await db();
  await sql.query(`INSERT INTO send_log (target_date, sent, skipped, failed) VALUES ($1, $2, $3, $4)`, [targetDate, sent, skipped, failed]);
}

export async function lastSends(limit = 5) {
  const sql = await db();
  return sql.query(
    `SELECT at, to_char(target_date, 'YYYY-MM-DD') AS target_date, sent, skipped, failed FROM send_log ORDER BY id DESC LIMIT $1`,
    [limit],
  );
}
