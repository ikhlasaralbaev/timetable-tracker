// Edupage proxy (Cloudflare Worker).
// Edupage Vercel/AWS IP'laridan ulanishni bloklaydi, shuning uchun so'rov shu Worker orqali o'tadi.
// Faqat bitta endpointga ruxsat bor va PROXY_KEY sarlavhasi talab qilinadi (ochiq proxy bo'lmasligi uchun).

const EDUPAGE_URL = "https://emu.edupage.org/timetable/server/regulartt.js?__func=regularttGetData";

export default {
  async fetch(request, env) {
    if (env.PROXY_KEY && request.headers.get("x-proxy-key") !== env.PROXY_KEY) {
      return new Response("Forbidden", { status: 403 });
    }

    const tt = new URL(request.url).searchParams.get("tt") || "165";
    if (!/^\d+$/.test(tt)) return new Response("Bad tt", { status: 400 });

    const t0 = Date.now();
    const res = await fetch(EDUPAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ __args: [null, tt], __gsh: "00000000" }),
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        "x-upstream-ms": String(Date.now() - t0),
      },
    });
  },
};
