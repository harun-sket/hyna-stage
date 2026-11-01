import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "npm:@e2b/code-interpreter";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sandboxId = new URL(req.url).searchParams.get("sandbox");
  if (!sandboxId) return new Response("Missing sandbox ID", { status: 400, headers: CORS });

  try {
    const sbx = await Sandbox.connect(sandboxId, { apiKey: Deno.env.get("E2B_API_KEY")! });
    
    // Read the command that deploy-stage saved
    const cmdFile = await sbx.files.read("/home/user/.hyna-test-cmd");
    const testCmd = cmdFile.trim() || "npm test";

    const result = await sbx.commands.run(testCmd, { timeoutMs: 30000 });

    let output = result.stdout + result.stderr;
    if (result.exitCode !== 0) output = "❌ TESTS FAILED\n\n" + output;
    else output = "✅ ALL TESTS PASSED\n\n" + output;

    return new Response(output, { headers: { ...CORS, "Content-Type": "text/plain" } });
  } catch (e) {
    return new Response("> Execution Error:\n" + e.message, { status: 500, headers: { ...CORS, "Content-Type": "text/plain" } });
  }
});
