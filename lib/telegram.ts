// Telegram Bot API uchun yupqa qatlam

const token = () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN o'rnatilmagan");
  return t;
};

export const botConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;

export class TelegramError extends Error {
  constructor(public code: number, description: string) {
    super(`Telegram ${code}: ${description}`);
  }
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (!json.ok) throw new TelegramError(json.error_code ?? res.status, json.description ?? "noma'lum xato");
  return json.result as T;
}

export function sendMessage(chatId: number | string, text: string) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

let username: string | null = null;
export async function botUsername() {
  username ??= (await tg<{ username: string }>("getMe")).username;
  return username;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
