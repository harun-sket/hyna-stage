import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const target = new URL(req.url).searchParams.get("url");
  if (!target) return new Response("Missing ?url=", { status: 400, headers: CORS });

  const res = await fetch(target, { headers: { "Accept": "text/html" } });
  let html = await res.text();

  const projectUrl = Deno.env.get("PROJECT_URL") ?? "";
  const tag = '<script src="' + projectUrl + '/functions/v1/verify-inject"></script>';
  html = html.replace("</body>", tag + "</body>");

  return new Response(html, {
    headers: {
      ...CORS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
