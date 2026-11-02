"use client";

// Butun admin ilovasi uchun umumiy ma'lumot: jadval, admin holati va bildirishnomalar.
// Sahifalar o'rtasida o'tganda jadval qayta yuklanmaydi.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Entry, FetchInfo, Teacher, Timetable } from "@/lib/edupage";

export type Data = Timetable & { info: FetchInfo };

export type AdminState = {
  status: { db: boolean; bot: boolean; cron: boolean; now: { date: string; time: string } };
  settings: { send_time: string; send_day: "today" | "tomorrow"; enabled: boolean; last_sent_date: string | null } | null;
  subscribers: { teacher_id: string; chat_id: string; username: string | null; first_name: string | null; created_at: string }[];
  sends: { at: string; target_date: string; sent: number; skipped: number; failed: number }[];
  bot: { username: string; webhookUrl: string; pending: number; lastError: string | null } | null;
};

type Toast = { id: number; text: string; tone: "ok" | "error" };

type Ctx = {
  data: Data | null;
  error: string | null;
  refreshing: boolean;
  reload: (refresh?: boolean) => Promise<void>;
  teacherById: Map<string, Teacher>;
  admin: AdminState | null;
  adminError: string | null;
  reloadAdmin: () => Promise<void>;
  linked: Set<string>;
  toasts: Toast[];
  notify: (text: string, tone?: Toast["tone"]) => void;
};

const DataContext = createContext<Ctx | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData DataProvider ichida ishlatilishi kerak");
  return ctx;
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("Sessiya tugadi");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Server ${res.status} javob qaytardi`);
  return json as T;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [admin, setAdmin] = useState<AdminState | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const reload = useCallback(async (refresh = false) => {
    setRefreshing(true);
    try {
      setData(await api<Data>("/api/timetable" + (refresh ? "?refresh=1" : "")));
      setError(null);
      if (refresh) notify("Jadval edupage'dan yangilandi");
    } catch (e) {
      if (refresh) notify("Yangilab bo'lmadi: " + (e as Error).message, "error");
      else setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [notify]);

  const reloadAdmin = useCallback(async () => {
    try {
      setAdmin(await api<AdminState>("/api/admin/state"));
      setAdminError(null);
    } catch (e) {
      setAdminError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    reloadAdmin();
  }, [reload, reloadAdmin]);

  const teacherById = useMemo(() => new Map((data?.teachers || []).map((t) => [t.id, t])), [data]);
  const linked = useMemo(() => new Set((admin?.subscribers || []).map((s) => s.teacher_id)), [admin]);

  const value = { data, error, refreshing, reload, teacherById, admin, adminError, reloadAdmin, linked, toasts, notify };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/* ---------- Umumiy yordamchilar ---------- */

export const DAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
export const DAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

// O'zbekcha guruhlash: 3 643 (brauzerlarda "uz" lokali ko'pincha vergul qo'yadi)
export const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, "\u202f");

// Toshkent vaqti (UTC+5, yozgi vaqt yo'q) — brauzer qaysi zonada bo'lishidan qat'i nazar
export function tashkent(now = Date.now()) {
  const d = new Date(now + 5 * 3600_000);
  return {
    weekday: (d.getUTCDay() + 6) % 7,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    label: `${DAY_NAMES[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`,
  };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// URL'da "*165" o'rniga "165"
export const teacherSlug = (id: string) => (id.startsWith("*") ? id.slice(1) : encodeURIComponent(id));
export function teacherIdFromSlug(slug: string, byId: Map<string, Teacher>) {
  const raw = decodeURIComponent(slug);
  return byId.has("*" + raw) ? "*" + raw : raw;
}

export const groupsOf = (e: Entry) => [...e.classes, ...e.groups].join(", ");
