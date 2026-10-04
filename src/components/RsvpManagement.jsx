import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { manageableTeams, gamesForManagedTeam } from "../utils/rsvpManagement.js";
import { formatGameDate, formatGameTime } from "../utils/scheduleHelpers.js";

export default function RsvpManagement({ access, active, onSaved }) {
    const [teams, setTeams] = useState([]);
    const [games, setGames] = useState([]);
    const [captains, setCaptains] = useState([]);
    const [teamId, setTeamId] = useState("");
    const [gameId, setGameId] = useState("");
    const [responses, setResponses] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!active) return;
            setLoading(true);
            setError("");
            try {
                const results = await Promise.all([
                    supabase.from("teams").select("id, name, team_members(profile_id, profiles(id, full_name))").order("name"),
                    supabase.from("games").select("*").order("game_date").order("start_time"),
                    supabase.from("team_captains").select("team_id, profile_id"),
                ]);
                const failure = results.find((result) => result.error);
                if (failure) throw failure.error;
                if (cancelled) return;
                setTeams(results[0].data ?? []);
                setGames(results[1].data ?? []);
                setCaptains(results[2].data ?? []);
            } catch (failure) {
                if (!cancelled) { setError(failure.message); setTeams([]); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [active]);

    const allowedTeams = manageableTeams(teams, access);
    const team = allowedTeams.find((entry) => String(entry.id) === teamId);
    const teamGames = gamesForManagedTeam(games, team?.id);
    const game = teamGames.find((entry) => String(entry.id) === gameId);
    const selectedGameId = game?.id;

    useEffect(() => {
        let cancelled = false;
        async function loadResponses() {
            if (!active || !selectedGameId) return;
            setResponses(null);
            setError("");
            try {
                const { data, error: failure } = await supabase.from("game_rsvps")
                    .select("profile_id, status").eq("game_id", selectedGameId);
                if (failure) throw failure;
                if (!cancelled) setResponses(Object.fromEntries((data ?? []).map((row) => [row.profile_id, row.status])));
            } catch (failure) {
                if (!cancelled) setError(failure.message);
            }
        }
        loadResponses();
        return () => { cancelled = true; };
    }, [selectedGameId, active]);

    async function saveRsvp(profile, status) {
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const { error: failure } = await supabase.rpc("manage_game_rsvp", {
                p_game_id: String(game.id), p_profile_id: String(profile.id), p_status: status,
                p_team_id: String(team.id),
            });
            if (failure) throw failure;
            setResponses((previous) => ({ ...previous, [profile.id]: status }));
            setNotice(`RSVP updated for ${profile.full_name}.`);
            onSaved();
        } catch (failure) {
            setError(`Could not save RSVP: ${failure.message}`);
        } finally { setSaving(false); }
    }

    async function setCaptain(profile, enabled) {
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const { error: failure } = await supabase.rpc("assign_team_captain", {
                p_team_id: String(team.id), p_profile_id: String(profile.id), p_enabled: enabled,
            });
            if (failure) throw failure;
            setCaptains((previous) => enabled
                ? [...previous, { team_id: team.id, profile_id: profile.id }]
                : previous.filter((row) => !(String(row.team_id) === teamId && row.profile_id === profile.id)));
            setNotice(`${profile.full_name} ${enabled ? "assigned as" : "removed as"} team captain.`);
        } catch (failure) {
            setError(`Could not update captain: ${failure.message}`);
        } finally { setSaving(false); }
    }

    return <div className="page-view">
        <div className="page-header"><h2>Manage RSVPs</h2></div>
        <p>Update player attendance for {access.is_admin ? "any team" : "your captain teams"}.
            {access.is_admin && " Assign or remove team captains below."}</p>
        {error && <p className="admin-save-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {loading ? <p role="status">Loading teams...</p> : <>
            <div className="admin-form-grid">
                <div className="form-field"><label htmlFor="managed-team">Team</label>
                    <select id="managed-team" value={team?.id ?? ""} disabled={saving} onChange={(event) => {
                        setTeamId(event.target.value); setGameId(""); setResponses(null); setNotice(""); setError("");
                    }}>
                        <option value="">Choose a team</option>
                        {allowedTeams.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </select>
                </div>
                <div className="form-field"><label htmlFor="managed-game">Game</label>
                    <select id="managed-game" value={game?.id ?? ""} disabled={!team || saving} onChange={(event) => {
                        setGameId(event.target.value); setResponses(null); setNotice(""); setError("");
                    }}>
                        <option value="">Choose a game</option>
                        {teamGames.map((entry) => <option key={entry.id} value={entry.id}>
                            {formatGameDate(entry.game_date)} {formatGameTime(entry.start_time)} ? {entry.home_team_name} vs {entry.away_team_name}
                        </option>)}
                    </select>
                </div>
            </div>
            {team && teamGames.length === 0 && <p>No games scheduled for this team.</p>}
            {game && responses === null && !error && <p role="status">Loading RSVPs...</p>}
            {team && <section className="content-card" style={{ overflowX: "auto" }}>
                <table className="admin-table"><thead><tr><th>Player</th><th>Role</th><th>RSVP</th></tr></thead>
                    <tbody>{(team.team_members ?? []).map((member) => {
                        const profile = member.profiles;
                        if (!profile) return null;
                        const captain = captains.some((row) => String(row.team_id) === teamId && row.profile_id === profile.id);
                        return <tr key={profile.id}>
                            <td>{profile.full_name}</td>
                            <td>{access.is_admin ? <label><input type="checkbox" checked={captain} disabled={saving}
                                onChange={(event) => setCaptain(profile, event.target.checked)}
                                aria-label={`Team captain: ${profile.full_name}`} /> Team captain</label>
                                : captain ? "Team captain" : "Player"}</td>
                            <td>{game && responses !== null ? <select value={responses[profile.id] ?? "pending"} disabled={saving}
                                aria-label={`RSVP for ${profile.full_name}`} onChange={(event) => saveRsvp(profile, event.target.value)}>
                                <option value="pending">No response</option><option value="going">Going</option>
                                <option value="maybe">Maybe</option><option value="out">Out</option>
                            </select> : "Choose a game to edit attendance"}</td>
                        </tr>;
                    })}</tbody>
                </table>
                {(team.team_members ?? []).length === 0 && <p>No players on this team.</p>}
            </section>}
        </>}
    </div>;
}
