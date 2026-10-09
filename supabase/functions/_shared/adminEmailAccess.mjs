// Pass a client scoped to the caller's verified JWT, never the service-role client.
export async function adminEmailAccess(caller) {
    const { data, error } = await caller.rpc('rsvp_management_access');
    if (error) return { allowed: false, status: 503, error: 'Unable to verify admin access. No email was queued.', code: 'admin_access_unavailable' };
    if (data?.is_admin !== true) return { allowed: false, status: 403, error: 'Admin access required. No email was queued.' };
    return { allowed: true, status: 200 };
}
