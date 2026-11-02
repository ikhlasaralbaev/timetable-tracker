// Diagnostika: Vercel serveridan edupage'ga so'rov o'tyaptimi va parse to'g'rimi.
// Ochish: /api/check  yoki  /api/check?teacher=*165
import { fetchRaw, parse } from "@/lib/edupage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const teacherId = new URL(req.url).searchParams.get("teacher");
  const env = {
    region: process.env.VERCEL_REGION || "local",
    node: process.version,
    time: new Date().toISOString(),
  };

  let raw;
  try {
    raw = await fetchRaw();
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    return Response.json(
      { ok: false, stage: "network", env, error: e.message, cause: e.cause?.code || e.cause?.message || null },
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
