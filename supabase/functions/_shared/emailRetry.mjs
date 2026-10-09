export function retryDelay(header, attempt, now = Date.now()) {
    const seconds = Number(header);
    const supplied = header && Number.isFinite(seconds) ? seconds
        : header ? (Date.parse(header) - now) / 1000 : 0;
    return Math.min(2147483647, Math.ceil(Math.max(2 ** Math.min(attempt, 8), Number.isFinite(supplied) ? supplied : 0)));
}

export function deliveryOutcome(status, body, retryAfter, attempt) {
    if (status >= 200 && status < 300 && typeof body?.id === 'string') {
        return { status: 'sent', delay: 0, pause: false, error: null, providerId: body.id };
    }
    const transient = status === 0 || status === 429 || status >= 500
        || (status === 409 && body?.name === 'concurrent_idempotent_requests')
        || (status >= 200 && status < 300);
    if (transient) {
        return { status: attempt >= 8 ? 'needs_review' : 'pending', delay: retryDelay(retryAfter, attempt),
            pause: status === 429, error: `Provider request ${status || 'unconfirmed'}; ${attempt >= 8 ? 'check Resend before resending' : 'will retry'}.`, providerId: null };
    }
    return { status: 'failed', delay: 0, pause: false, error: `Provider rejected request (${status}).`, providerId: null };
}
