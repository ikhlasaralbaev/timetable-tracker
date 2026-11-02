import { getTimetable } from "@/lib/edupage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.has("refresh");
  try {
    const { data, info } = await getTimetable(refresh);
    return Response.json({ ...data, info });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}

function errorMessage(err: unknown) {
  const e = err as Error & { cause?: { code?: string; message?: string } };
  return [e.message, e.cause?.code, e.cause?.message].filter(Boolean).join(" — ");
}
