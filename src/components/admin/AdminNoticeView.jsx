import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const EMPTY_FORM = { title: "", message: "", notice_type: "banner" };

export default function AdminNoticeView({ leagueName, onNoticeChanged }) {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const activeTicker = notices.find((n) => n.is_active && n.notice_type === "ticker") ?? null;
    const activeBanner = notices.find((n) => n.is_active && n.notice_type === "banner") ?? null;

    useEffect(() => {
        async function load() {
            const { data, error } = await supabase
                .from("league_notices")
                .select("*")
                .eq("league_name", leagueName)
                .order("created_at", { ascending: false });

            if (!error) setNotices(data ?? []);
            setLoading(false);
        }
        load();
    }, [leagueName]);

    async function publishNotice(e) {
        e.preventDefault();
        if (!form.title.trim()) {
            setSaveError("Title is required.");
            return;
        }

        setSaving(true);
        setSaveError("");

        const existingActive = form.notice_type === "ticker" ? activeTicker : activeBanner;
        if (existingActive) {
            await supabase
                .from("league_notices")
                .update({ is_active: false })
                .eq("id", existingActive.id);
        }

        const { data, error } = await supabase
            .from("league_notices")
            .insert({
                league_name: leagueName,
                title: form.title.trim(),
                message: form.notice_type === "banner" ? (form.message.trim() || null) : null,
                notice_type: form.notice_type,
                is_active: true,
            })
            .select()
            .single();

        setSaving(false);

        if (error) {
            setSaveError(error.message);
            return;
        }

        setNotices((prev) => [
            data,
            ...prev.map((n) =>
                n.notice_type === form.notice_type ? { ...n, is_active: false } : n
            ),
        ]);
        setForm({ ...EMPTY_FORM, notice_type: form.notice_type });
        onNoticeChanged?.();
    }

    async function clearNotice(notice) {
        const { error } = await supabase
            .from("league_notices")
            .update({ is_active: false })
            .eq("id", notice.id);

        if (error) { alert(error.message); return; }

        setNotices((prev) =>
            prev.map((n) => n.id === notice.id ? { ...n, is_active: false } : n)
        );
        onNoticeChanged?.();
    }

    async function deleteNotice(notice) {
        if (!window.confirm("Delete this notice permanently?")) return;

        const { error } = await supabase
            .from("league_notices")
            .delete()
            .eq("id", notice.id);

        if (error) { alert(error.message); return; }

        setNotices((prev) => prev.filter((n) => n.id !== notice.id));
        if (notice.is_active) onNoticeChanged?.();
    }

    async function reactivateNotice(notice) {
        const existingActive = notice.notice_type === "ticker" ? activeTicker : activeBanner;
        if (existingActive) {
            await supabase
                .from("league_notices")
                .update({ is_active: false })
                .eq("id", existingActive.id);
        }

        const { error } = await supabase
            .from("league_notices")
            .update({ is_active: true })
            .eq("id", notice.id);

        if (error) { alert(error.message); return; }

        setNotices((prev) =>
            prev.map((n) => ({
                ...n,
                is_active: n.notice_type === notice.notice_type ? n.id === notice.id : n.is_active,
            }))
        );
        onNoticeChanged?.();
    }

    if (loading) {
        return (
            <div className="page-view">
                <p className="empty-state">Loading…</p>
            </div>
        );
    }

    const pastNotices = notices.filter((n) => !n.is_active);

    return (
        <div className="page-view">
            <div className="page-header">
                <h2>Admin · League Notices</h2>
                <p className="page-subtitle">
                    Publish a top ticker or a bottom banner on the Dashboard.
                </p>
            </div>

            {/* Active notices */}
            <div className="notice-active-row">
                {/* Ticker */}
                <section className={`content-card notice-active-card notice-active-card--half${activeTicker ? " notice-active-card--live" : ""}`}>
                    <div className="notice-active-header">
                        <div>
                            <span className="notice-type-badge notice-type-badge--ticker">Top Ticker</span>
                            {activeTicker
                                ? <strong className="notice-active-title">{activeTicker.title}</strong>
                                : <span className="notice-active-empty">None active</span>}
                        </div>
                        {activeTicker && (
                            <button
                                type="button"
                                className="action-btn action-btn--danger"
                                onClick={() => clearNotice(activeTicker)}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </section>

                {/* Banner */}
                <section className={`content-card notice-active-card notice-active-card--half${activeBanner ? " notice-active-card--live" : ""}`}>
                    <div className="notice-active-header">
                        <div>
                            <span className="notice-type-badge notice-type-badge--banner">Bottom Banner</span>
                            {activeBanner
                                ? <strong className="notice-active-title">{activeBanner.title}</strong>
                                : <span className="notice-active-empty">None active</span>}
                        </div>
                        {activeBanner && (
                            <button
                                type="button"
                                className="action-btn action-btn--danger"
                                onClick={() => clearNotice(activeBanner)}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {activeBanner?.message && (
                        <p className="notice-active-message">{activeBanner.message}</p>
                    )}
                </section>
            </div>

            {/* Publish form */}
            <section className="content-card">
                <header className="content-card-header">
                    <h2>Publish New Notice</h2>
                </header>
                <form className="admin-notice-form" onSubmit={publishNotice}>
                    {/* Type toggle */}
                    <div className="notice-type-toggle">
                        <label className={`notice-type-option${form.notice_type === "ticker" ? " is-selected" : ""}`}>
                            <input
                                type="radio"
                                name="notice_type"
                                value="ticker"
                                checked={form.notice_type === "ticker"}
                                onChange={() => setForm((f) => ({ ...f, notice_type: "ticker" }))}
                            />
                            <span>Top Ticker</span>
                            <small>Single sentence, shown at top of dashboard</small>
                        </label>
                        <label className={`notice-type-option${form.notice_type === "banner" ? " is-selected" : ""}`}>
                            <input
                                type="radio"
                                name="notice_type"
                                value="banner"
                                checked={form.notice_type === "banner"}
                                onChange={() => setForm((f) => ({ ...f, notice_type: "banner" }))}
                            />
                            <span>Bottom Banner</span>
                            <small>Title + optional message, shown at bottom of dashboard</small>
                        </label>
                    </div>

                    <div className="form-field">
                        <label>
                            {form.notice_type === "ticker" ? "One-line message *" : "Title *"}
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder={
                                form.notice_type === "ticker"
                                    ? "e.g. Use code SAVE20 for 15% off gear at Pure Hockey"
                                    : "e.g. Rink closed Nov 3rd"
                            }
                        />
                    </div>

                    {form.notice_type === "banner" && (
                        <div className="form-field">
                            <label>Message <span className="form-field-optional">(optional)</span></label>
                            <textarea
                                value={form.message}
                                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                                placeholder="Additional details…"
                                rows={3}
                            />
                        </div>
                    )}

                    {saveError && <p className="admin-save-error">{saveError}</p>}
                    <div className="admin-notice-form-footer">
                        <button
                            type="submit"
                            className="action-btn action-btn--primary"
                            disabled={saving}
                        >
                            {saving ? "Publishing…" : "Publish"}
                        </button>
                    </div>
                </form>
            </section>

            {/* History */}
            {pastNotices.length > 0 && (
                <section className="content-card">
                    <header className="content-card-header">
                        <h2>Past Notices</h2>
                    </header>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pastNotices.map((notice) => (
                                <tr key={notice.id}>
                                    <td>
                                        <span className={`notice-type-badge notice-type-badge--${notice.notice_type}`}>
                                            {notice.notice_type === "ticker" ? "Ticker" : "Banner"}
                                        </span>
                                    </td>
                                    <td><strong>{notice.title}</strong></td>
                                    <td className="admin-table-nowrap">
                                        {new Date(notice.created_at).toLocaleDateString("en-US", {
                                            month: "short", day: "numeric", year: "numeric",
                                        })}
                                    </td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            className="action-btn action-btn--outline"
                                            onClick={() => reactivateNotice(notice)}
                                        >
                                            Repost
                                        </button>
                                        <button
                                            type="button"
                                            className="action-btn action-btn--danger"
                                            onClick={() => deleteNotice(notice)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
}
