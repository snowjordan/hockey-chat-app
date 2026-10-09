export function emailPayload(payload) {
    const recipients = [...new Set(payload.recipients.map((email) => email.trim().toLowerCase()))].sort();
    const subject = payload.subject.trim();
    const message = payload.message.trim();
    if (!recipients.length || recipients.length > 20 || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        || !subject || subject.length > 200 || !message || message.length > 10000) {
        throw new Error("Choose 1–20 email addresses, a subject up to 200 characters, and a message up to 10,000 characters.");
    }
    return { recipients, subject, message };
}

// This fingerprint is a hash of the email draft, not biometric or device data.
// Store only the hash and UUID so unchanged retries reuse the same request ID.
export async function emailRequestId(storage, key, payload) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(emailPayload(payload))));
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    let previous;
    try { previous = JSON.parse(storage.getItem(key)); } catch { /* Invalid previous metadata. */ }
    if (previous?.fingerprint === fingerprint && typeof previous.requestId === 'string') return previous.requestId;
    const requestId = crypto.randomUUID();
    storage.setItem(key, JSON.stringify({ fingerprint, requestId }));
    return requestId;
}

export async function sendAdminEmail(invoke, functionName, payload) {
    const { recipients, subject, message } = emailPayload(payload);
    if (!functionName) throw new Error("The admin email function name has not been configured.");
    const requestId = payload.requestId ?? crypto.randomUUID();
    let result;
    try {
        result = await invoke(functionName, { body: { recipients, subject, message, requestId } });
    } catch {
        throw new Error("Could not confirm submission. Retry the unchanged message to reuse its request ID, or check recent email activity before composing another message.");
    }
    let response = result.data;
    if (result.error?.context && typeof result.error.context.json === "function") {
        try { response = await result.error.context.json(); } catch { /* Unknown submission state. */ }
    }
    const status = result.error?.context?.status;
    if (status === 401) throw new Error("Your sign-in has expired. Sign in again before sending. No email was queued.");
    if (status === 403) throw new Error("Admin access required. Your account is not authorized to send admin emails. No email was queued.");
    if (response?.code === 'admin_access_unavailable') throw new Error(response.error);
    if (!result.error && !response?.error && response?.batchId === requestId
        && response?.queued === recipients.length && response?.requested === recipients.length) {
        return { queued: response.queued, batchId: response.batchId };
    }
    if (response?.retryAfter > 0 && Number.isFinite(response.retryAfter)) {
        const failure = new Error(`${response.error || 'Please wait before sending again.'} Try again in ${response.retryAfter} seconds.`);
        failure.retryAfter = response.retryAfter;
        throw failure;
    }
    // Preserve compatibility during rollout of the queue-backed Edge Function.
    const validCount = response?.requested === recipients.length && Number.isInteger(response?.sent)
        && response.sent >= 0 && response.sent <= recipients.length;
    if (!result.error && !response?.error && validCount && response.sent === recipients.length) return { sent: response.sent };
    if (validCount) {
        const failure = new Error(`${response.sent} of ${recipients.length} email requests were accepted. Accepted recipients have been removed from the selection. ${response.error || "Sending did not complete."}`);
        failure.acceptedRecipients = recipients.slice(0, response.sent);
        throw failure;
    }
    const detail = typeof response?.error === "string" ? `${response.error} ` : "";
    throw new Error(`${detail}Could not confirm submission. Check recent email activity and Resend activity before changing the message or recipients. You can retry the unchanged message with the same request ID.`);
}
