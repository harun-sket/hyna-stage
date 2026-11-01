import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "npm:@e2b/code-interpreter";
import { createClient } from "npm:@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const ttl = body.ttl ?? 600;
    const templateName = body.template;

    // 1. Connect to Supabase DB
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Fetch template from DB
    const { data: t, error } = await supabase
      .from("templates")
      .select("*")
      .eq("name", templateName)
      .single();

    if (error || !t) throw new Error(`Template '${templateName}' not found in marketplace.`);

    // 3. Spin up the Sandbox
    const sbx = await Sandbox.create({
      apiKey: Deno.env.get("E2B_API_KEY")!,
      timeoutMs: ttl * 1000,
    });

    // 4. Write files and Test Command
    for (const [path, content] of Object.entries(t.files)) {
      await sbx.files.write(`/home/user/${path}`, content as string);
    }
    // Save the test command for the runner to use
    await sbx.files.write("/home/user/.hyna-test-cmd", t.test_cmd);

    // 5. Install & Start
    if (t.install_cmd) await sbx.commands.run(t.install_cmd, { timeoutMs: 180000 });
    await sbx.commands.run(t.start_cmd, { background: true, timeoutMs: 30000 });

    // 6. Wait for port
    let ready = false;
    for (let i = 0; i < 25; i++) {
      const r = await sbx.commands.run(`curl -s -o /dev/null -w '%{http_code}' http://localhost:${t.port}`, { timeoutMs: 5000 });
      if (r.stdout.trim() === "200") { ready = true; break; }
      await new Promise((res) => setTimeout(res, 1000));
    }
    if (!ready) throw new Error(`Port ${t.port} never opened.`);

    return new Response(JSON.stringify({
      id: sbx.sandboxId,
      url: `https://${sbx.getHost(t.port)}`,
      ttl,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
