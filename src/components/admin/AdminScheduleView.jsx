import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatGameDate, formatGameTime } from "../../utils/scheduleHelpers";

const EMPTY_FORM = {
    game_date: "",
    start_time: "",
    end_time: "",
    home_team_id: "",
    home_team_name: "",
    away_team_id: "",
    away_team_name: "",
    location_name: "",
    rink: "",
};

export default function AdminScheduleView() {
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingGame, setEditingGame] = useState(null);
    const [isNewGame, setIsNewGame] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        async function load() {
            const [gamesResult, teamsResult] = await Promise.all([
                supabase.from("games").select("*").order("starts_at", { ascending: true }),
                supabase.from("teams").select("id, name").order("name"),
            ]);
            if (!gamesResult.error) setGames(gamesResult.data ?? []);
            if (!teamsResult.error) setTeams(teamsResult.data ?? []);
            setLoading(false);
        }
        load();
    }, []);

    function openEdit(game) {
        setIsNewGame(false);
        setEditingGame({ ...EMPTY_FORM, ...game });
        setSaveError("");
    }

    function openNew() {
        setIsNewGame(true);
        setEditingGame({ ...EMPTY_FORM });
        setSaveError("");
    }

    function closeEdit() {
        setEditingGame(null);
        setIsNewGame(false);
        setSaveError("");
    }

    function handleField(field, value) {
        setEditingGame((prev) => ({ ...prev, [field]: value }));
    }

    function handleTeamSelect(side, teamId) {
        const team = teams.find((t) => t.id === teamId);
        setEditingGame((prev) => ({
            ...prev,
            [`${side}_team_id`]: teamId,
            [`${side}_team_name`]: team?.name ?? "",
        }));
    }

    async function saveGame() {
        if (!editingGame) return;
        setSaving(true);
        setSaveError("");

        if (isNewGame) {
            const { id: _ignored, ...fields } = editingGame;
            const { data, error } = await supabase
                .from("games")
                .insert(fields)
                .select()
                .single();

            setSaving(false);

            if (error) {
                setSaveError(error.message);
                return;
            }

            setGames((prev) =>
                [...prev, data].sort((a, b) =>
                    (a.starts_at ?? a.game_date ?? "") < (b.starts_at ?? b.game_date ?? "") ? -1 : 1
                )
            );
            closeEdit();
        } else {
            const { id, ...fields } = editingGame;
            const { error } = await supabase.from("games").update(fields).eq("id", id);

            setSaving(false);

            if (error) {
                setSaveError(error.message);
                return;
            }

            setGames((prev) => prev.map((g) => (g.id === id ? { ...editingGame } : g)));
            closeEdit();
        }
    }

    async function deleteGame(game) {
        if (!window.confirm(`Delete "${game.home_team_name ?? "TBD"} vs ${game.away_team_name ?? "TBD"}" on ${game.game_date}?`)) {
            return;
        }
        const { error } = await supabase.from("games").delete().eq("id", game.id);
        if (error) {
            alert(error.message);
            return;
        }
        setGames((prev) => prev.filter((g) => g.id !== game.id));
    }

    if (loading) {
        return (
            <div className="page-view">
                <p className="empty-state">Loading schedule…</p>
            </div>
        );
    }

    return (
        <div className="page-view">
            <div className="page-header admin-page-header">
                <div>
                    <h2>Admin · Schedule</h2>
                    <p className="page-subtitle">{games.length} games</p>
                </div>
                <button
                    type="button"
                    className="action-btn action-btn--primary"
                    onClick={openNew}
                >
                    + Add Game
                </button>
            </div>

            <section className="content-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Home</th>
                            <th>Away</th>
                            <th>Location</th>
                            <th>Rink</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {games.length === 0 && (
                            <tr>
                                <td colSpan={8} className="admin-table-empty">
                                    No games found.
                                </td>
                            </tr>
                        )}
                        {games.map((game) => (
                            <tr key={game.id}>
                                <td>{formatGameDate(game.game_date)}</td>
                                <td className="admin-table-nowrap">{formatGameTime(game.start_time)}</td>
                                <td>{game.home_team_name ?? "TBD"}</td>
                                <td>{game.away_team_name ?? "TBD"}</td>
                                <td>{game.location_name ?? "—"}</td>
                                <td>{game.rink ?? "—"}</td>
                                <td className="admin-table-actions">
                                    <button
                                        type="button"
                                        className="action-btn action-btn--outline"
                                        onClick={() => openEdit(game)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="action-btn action-btn--danger"
                                        onClick={() => deleteGame(game)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {editingGame && (
                <div className="modal-overlay" onClick={closeEdit}>
                    <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{isNewGame ? "New Game" : "Edit Game"}</h3>
                            <button type="button" className="modal-close" onClick={closeEdit}>
                                ✕
                            </button>
                        </div>

                        <div className="modal-details">
                            <div className="admin-form-grid">
                                <div className="form-field">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={editingGame.game_date ?? ""}
                                        onChange={(e) => handleField("game_date", e.target.value)}
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Start Time</label>
                                    <input
                                        type="time"
                                        value={editingGame.start_time ?? ""}
                                        onChange={(e) => handleField("start_time", e.target.value)}
                                    />
                                </div>

                                <div className="form-field">
                                    <label>End Time</label>
                                    <input
                                        type="time"
                                        value={editingGame.end_time ?? ""}
                                        onChange={(e) => handleField("end_time", e.target.value)}
                                    />
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Home Team</label>
                                    <select
                                        value={editingGame.home_team_id ?? ""}
                                        onChange={(e) => handleTeamSelect("home", e.target.value)}
                                    >
                                        <option value="">— select —</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Away Team</label>
                                    <select
                                        value={editingGame.away_team_id ?? ""}
                                        onChange={(e) => handleTeamSelect("away", e.target.value)}
                                    >
                                        <option value="">— select —</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Location</label>
                                    <input
                                        type="text"
                                        value={editingGame.location_name ?? ""}
                                        onChange={(e) => handleField("location_name", e.target.value)}
                                        placeholder="Arena or facility name"
                                    />
                                </div>

                                <div className="form-field form-field--full">
                                    <label>Rink</label>
                                    <input
                                        type="text"
                                        value={editingGame.rink ?? ""}
                                        onChange={(e) => handleField("rink", e.target.value)}
                                        placeholder="e.g. Rink A"
                                    />
                                </div>
                            </div>

                            {saveError && (
                                <p className="admin-save-error">{saveError}</p>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="action-btn action-btn--secondary"
                                onClick={closeEdit}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="action-btn action-btn--primary"
                                onClick={saveGame}
                                disabled={saving}
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
