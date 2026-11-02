// Diagnostika: Vercel serveridan edupage'ga so'rov o'tyaptimi va parse to'g'rimi.
// Ochish: /api/check  yoki  /api/check?teacher=*165
import { lookup } from "node:dns/promises";
import { connect } from "node:net";
import { fetchRaw, parse } from "@/lib/edupage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EDUPAGE_HOST = "emu.edupage.org";

// TCP darajasida ulanishni sinash: IPv4 va IPv6 alohida
async function tcpProbe(family: 4 | 6) {
  let address: string;
  try {
    ({ address } = await lookup(EDUPAGE_HOST, { family }));
  } catch (err) {
    return { family, ok: false, error: "dns: " + (err as Error).message };
  }
  const t0 = Date.now();
  return new Promise<Record<string, unknown>>((resolve) => {
    const socket = connect({ host: address, port: 443, family });
    const done = (r: Record<string, unknown>) => { socket.destroy(); resolve({ family, address, ms: Date.now() - t0, ...r }); };
    socket.setTimeout(8000, () => done({ ok: false, error: "timeout" }));
    socket.once("connect", () => done({ ok: true }));
    socket.once("error", (err) => done({ ok: false, error: (err as NodeJS.ErrnoException).code || err.message }));
  });
}

// Nazorat: funksiyadan umuman tashqi internetga chiqish bormi
async function controlProbe() {
  const t0 = Date.now();
  try {
    const res = await fetch("https://www.google.com/generate_204", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return { ok: true, status: res.status, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message, ms: Date.now() - t0 };
  }
}

export async function GET(req: Request) {
  const teacherId = new URL(req.url).searchParams.get("teacher");
  const env = {
    region: process.env.VERCEL_REGION || "local",
    via: process.env.EDUPAGE_PROXY_URL ? "proxy" : "direct",
    node: process.version,
    time: new Date().toISOString(),
  };

  let raw;
  try {
    raw = await fetchRaw();
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const [tcp4, tcp6, control] = await Promise.all([tcpProbe(4), tcpProbe(6), controlProbe()]);
    return Response.json(
      { ok: false, stage: "network", env, error: e.message, cause: e.cause?.code || e.cause?.message || null, probes: { tcp4, tcp6, control } },
      { status: 502 },
    );
  }

  try {
    const t0 = Date.now();
    const data = parse(raw.json);
    const parseMs = Date.now() - t0;
    const teacher = teacherId ? data.teachers.find((t) => t.id === teacherId) : null;

    return Response.json({
      ok: true,
      env,
      network: { status: raw.status, bytes: raw.bytes, fetchMs: raw.fetchMs },
      parse: {
        parseMs,
        entries: data.entries.length,
        teachers: data.teachers.length,
        teachersWithLessons: data.teachers.filter((t) => t.count > 0).length,
        periods: data.periods,
        dayCount: data.dayCount,
      },
      teacher: teacher
        ? {
            ...teacher,
            lessons: data.entries
              .filter((e) => e.teacherIds.includes(teacher.id))
              .sort((a, b) => a.day - b.day || a.period - b.period)
              .map((e) => ({ day: e.day, period: e.period, time: `${e.start}–${e.end}`, subject: e.subject, groups: [...e.classes, ...e.groups], rooms: e.rooms })),
          }
        : teacherId
          ? { error: `${teacherId} topilmadi` }
          : undefined,
    });
  } catch (err) {
    return Response.json({ ok: false, stage: "parse", env, network: { status: raw.status, bytes: raw.bytes, fetchMs: raw.fetchMs }, error: (err as Error).message }, { status: 500 });
  }
}
