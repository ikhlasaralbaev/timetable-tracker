// Admin route'lari uchun umumiy xato javobi
export function errorResponse(err: unknown, status = 500) {
  const e = err as Error & { cause?: { code?: string } };
  return Response.json({ error: [e.message, e.cause?.code].filter(Boolean).join(" — ") }, { status });
}
