import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { adminEmailAccess } from "../_shared/adminEmailAccess.mjs";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200, headers = {}) => Response.json(body, { status, headers: { ...cors, ...headers } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const bearer = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return json({ error: "Sign in required." }, 401);
    const { data: { user }, error: authError } = await db.auth.getUser(bearer);
    if (authError || !user) return json({ error: "Sign in required." }, 401);
    // Match the app's database-backed admin decision using the caller's identity.
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const access = await adminEmailAccess(caller);
    if (!access.allowed) return json({ error: access.error, code: access.code }, access.status);
    let payload;
    try { payload = await req.json(); } catch { return json({ error: "Invalid JSON request." }, 400); }
    if (!payload || typeof payload !== "object") return json({ error: "Invalid request." }, 400);
    if (payload.action === "status") {
      const { data, error } = await db.from("admin_email_batches")
        .select("id, subject, created_at, admin_email_jobs(recipient,status,last_error)")
        .eq("caller_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return json({ batches: data });
    }
    if (!Array.isArray(payload.recipients) || !payload.recipients.every((email: unknown) => typeof email === "string")
        || typeof payload.subject !== "string" || typeof payload.message !== "string"
        || typeof payload.requestId !== "string" || !uuid.test(payload.requestId)) return json({ error: "Invalid email fields." }, 400);
    const recipients = [...new Set<string>(payload.recipients.map((email: string) => email.trim().toLowerCase()))].sort();
    const subject = payload.subject.trim();
    const message = payload.message.trim();
    if (!recipients.length || recipients.length > 20 || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        || !subject || subject.length > 200 || !message || message.length > 10000) return json({ error: "Invalid recipients, subject, or message." }, 400);
    const sender = Deno.env.get("ADMIN_EMAIL_FROM");
    if (!sender || !Deno.env.get("RESEND_API_KEY")) return json({ error: "Email service unavailable." }, 503);
    const { data, error } = await db.rpc("enqueue_admin_email", { p_id: payload.requestId, p_caller: user.id,
      p_sender: sender, p_recipients: recipients, p_subject: subject, p_message: message });
    if (error) throw error;
    return json(data, data.status ?? 202, data.retryAfter ? { "Retry-After": String(data.retryAfter) } : {});
  } catch {
    console.error("Admin email queue request failed.");
    return json({ error: "Could not confirm the queue request. Retry the same message safely." }, 503);
  }
});
