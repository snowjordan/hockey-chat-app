import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { deliveryOutcome } from "../_shared/emailRetry.mjs";

Deno.serve(async (req) => {
  const secret = Deno.env.get("ADMIN_EMAIL_WORKER_SECRET");
  if (!secret || req.headers.get("x-email-worker-secret") !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return Response.json({ error: "Email service unavailable." }, { status: 503 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const deadline = Date.now() + 45000;
  let processed = 0;
  try {
    while (Date.now() < deadline) {
      const { data: job, error } = await db.rpc("claim_admin_email");
      if (error) throw error;
      if (!job) break;
      let status = 0;
      let body = null;
      let retryAfter = null;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `admin-email/${job.id}` },
          body: JSON.stringify({ from: job.sender, to: [job.recipient], subject: job.subject, text: job.message }),
        });
        status = response.status;
        retryAfter = response.headers.get("retry-after");
        try { body = await response.json(); } catch { /* Preserve unknown outcomes for retry with the same key. */ }
      } catch { /* Network timeout: retry with the same key and immutable payload. */ }
      const outcome = deliveryOutcome(status, body, retryAfter, job.attempt);
      const { data: finished, error: finishError } = await db.rpc("finish_admin_email", {
        p_id: job.id, p_token: job.token, p_status: outcome.status, p_delay: outcome.delay,
        p_global_pause: outcome.pause, p_error: outcome.error, p_provider_id: outcome.providerId,
      });
      if (finishError || !finished) throw finishError ?? new Error("Lease lost");
      processed++;
      if (outcome.pause) break;
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    return Response.json({ processed });
  } catch {
    console.error("Admin email worker interrupted; durable jobs remain queued.");
    return Response.json({ error: "Worker interrupted." }, { status: 503 });
  }
});
