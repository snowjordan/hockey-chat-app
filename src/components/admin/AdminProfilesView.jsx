import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ProfileEditor from "../ProfileEditor";

const EMPTY_NEW_PLAYER = {
    full_name: "",
    email: "",
    phone: "",
    team_id: "",
    jersey_number: "",
    position: "",
};

const POSITIONS = ["forward", "defense", "goalie"];

async function fetchProfiles() {
    const { data, error } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            email,
            phone,
            is_admin,
            team_members (
                position,
                jersey_number,
                teams ( name )
            )
        `)
        .order("full_name");
    return error ? [] : (data ?? []);
}

export default function AdminProfilesView() {
    const [profiles, setProfiles] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProfile, setEditingProfile] = useState(null);
    const [newPlayer, setNewPlayer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        async function load() {
            const [profileData, teamsResult] = await Promise.all([
                fetchProfiles(),
                supabase.from("teams").select("id, name").order("name"),
            ]);
            setProfiles(profileData);
            if (!teamsResult.error) setTeams(teamsResult.data ?? []);
            setLoading(false);
        }
        load();
    }, []);

    async function deleteProfile(profile) {
        if (!window.confirm(`Delete profile for "${profile.full_name}"? This cannot be undone.`)) {
            return;
        }
        const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
        if (error) {
            alert(error.message);
            return;
        }
        setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    }

    function handleNewField(field, value) {
        setNewPlayer((prev) => ({ ...prev, [field]: value }));
    }

    async function saveNewPlayer() {
        if (!newPlayer.full_name.trim() || !newPlayer.email.trim() || !newPlayer.phone.trim()) {
            setSaveError("Name, email, and phone are required.");
            return;
        }

        setSaving(true);
        setSaveError("");

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .insert({
                full_name: newPlayer.full_name.trim(),
                email: newPlayer.email.trim(),
                phone: newPlayer.phone.trim(),
            })
            .select()
            .single();

        if (profileError) {
            setSaveError(profileError.message);
            setSaving(false);
            return;
        }

        if (newPlayer.team_id) {
            const { error: memberError } = await supabase
                .from("team_members")
                .insert({
                    profile_id: profile.id,
                    team_id: newPlayer.team_id,
                    jersey_number: newPlayer.jersey_number ? Number(newPlayer.jersey_number) : null,
                    position: newPlayer.position || null,
                });

            if (memberError) {
                setSaveError(`Profile created but team assignment failed: ${memberError.message}`);
                setSaving(false);
                return;
            }
        }

        setSaving(false);
        setNewPlayer(null);
        setProfiles(await fetchProfiles());
    }

    if (editingProfile) {
        return (
            <ProfileEditor
                profile={editingProfile}
                onBack={() => setEditingProfile(null)}
                onSaved={async () => {
                    setEditingProfile(null);
                    setLoading(true);
                    setProfiles(await fetchProfiles());
                    setLoading(false);
                }}
            />
        );
    }

    if (loading) {
        return (
            <div className="page-view">
                <p className="empty-state">Loading profiles…</p>
            </div>
        );
    }

    return (
        <div className="page-view">
            <div className="page-header admin-page-header">
                <div>
                    <h2>Admin · Players</h2>
                    <p className="page-subtitle">{profiles.length} profiles</p>
                </div>
                <button
                    type="button"
                    className="action-btn action-btn--primary"
                    onClick={() => { setNewPlayer({ ...EMPTY_NEW_PLAYER }); setSaveError(""); }}
                >
                    + Add Player
                </button>
            </div>

            <section className="content-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Team</th>
                            <th>Position</th>
                            <th>#</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {profiles.length === 0 && (
                            <tr>
                                <td colSpan={7} className="admin-table-empty">
                                    No profiles found.
                                </td>
                            </tr>
                        )}
                        {profiles.map((profile) => {
                            const member = profile.team_members?.[0];
                            return (
                                <tr key={profile.id}>
                                    <td>
                                        <strong>{profile.full_name ?? "—"}</strong>
                                        {profile.is_admin && (
                                            <span className="admin-badge">admin</span>
                                        )}
                                    </td>
                                    <td>{profile.email ?? "—"}</td>
                                    <td className="admin-table-nowrap">{profile.phone ?? "—"}</td>
                                    <td>{member?.teams?.name ?? "—"}</td>
                                    <td>{member?.position ?? "—"}</td>
                                    <td>{member?.jersey_number ?? "—"}</td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            className="action-btn action-btn--outline"
                                            onClick={() => setEditingProfile(profile)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="action-btn action-btn--danger"
                                            onClick={() => deleteProfile(profile)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            {newPlayer && (
                <div className="modal-overlay" onClick={() => setNewPlayer(null)}>
                    <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Player</h3>
                            <button type="button" className="modal-close" onClick={() => setNewPlayer(null)}>✕</button>
                        </div>

                        <div className="modal-details">
                            <div className="admin-form-grid">
                                <div className="form-field form-field--full">
                                    <label>Full Name *</label>
                                    <input
                                        type="text"
                                        value={newPlayer.full_name}
                                        onChange={(e) => handleNewField("full_name", e.target.value)}
                                        placeholder="Jane Smith"
                                        autoFocus
                                    />
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={newPlayer.email}
                                        onChange={(e) => handleNewField("email", e.target.value)}
                                        placeholder="jane@example.com"
                                    />
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Phone *</label>
                                    <input
                                        type="tel"
                                        value={newPlayer.phone}
                                        onChange={(e) => handleNewField("phone", e.target.value)}
                                        placeholder="555-555-5555"
                                    />
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Team</label>
                                    <select
                                        value={newPlayer.team_id}
                                        onChange={(e) => handleNewField("team_id", e.target.value)}
                                    >
                                        <option value="">— no team —</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Position</label>
                                    <select
                                        value={newPlayer.position}
                                        onChange={(e) => handleNewField("position", e.target.value)}
                                    >
                                        <option value="">— select —</option>
                                        {POSITIONS.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Jersey #</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="99"
                                        value={newPlayer.jersey_number}
                                        onChange={(e) => handleNewField("jersey_number", e.target.value)}
                                        placeholder="00"
                                    />
                                </div>
                            </div>

                            {saveError && <p className="admin-save-error">{saveError}</p>}
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="action-btn action-btn--secondary"
                                onClick={() => setNewPlayer(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="action-btn action-btn--primary"
                                onClick={saveNewPlayer}
                                disabled={saving}
                            >
                                {saving ? "Saving…" : "Add Player"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
