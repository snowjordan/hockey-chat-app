import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { manageableTeams, gamesForManagedTeam } from "../utils/rsvpManagement.js";
import { formatDateKey, formatGameDate, formatGameTime } from "../utils/scheduleHelpers.js";

const ATTENDANCE_OPTIONS = [
    { value: "going", label: "Going" },
    { value: "maybe", label: "Maybe" },
    { value: "out", label: "Out" },
    { value: "pending", label: "No response" },
];

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
    const [teamSearch, setTeamSearch] = useState("");
    const [showPastGames, setShowPastGames] = useState(false);

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

    const players = (team?.team_members ?? []).map((member) => member.profiles).filter(Boolean);
    const visibleTeams = allowedTeams.filter((entry) => entry.name.toLowerCase().includes(teamSearch.trim().toLowerCase()));
    const today = formatDateKey(new Date());
    const visibleGames = teamGames.filter((entry) => showPastGames || entry.game_date >= today);

    function chooseTeam(entry) {
        setTeamId(String(entry.id));
        setGameId("");
        setResponses(null);
        setNotice("");
        setError("");
    }

    return <div className="page-view rsvp-management">
        <div className="page-header">
            <h2>{access.is_admin ? "Admin \u00b7 Manage RSVPs" : "Manage RSVPs"}</h2>
            <p className="page-subtitle">Choose a team and game to update player attendance.
                {access.is_admin && " Manage team captains from the roster."}</p>
        </div>
        {error && <p className="admin-save-error" role="alert">{error}</p>}
        {notice && <p className="rsvp-notice" role="status">{notice}</p>}
        {loading ? <section className="content-card"><p className="empty-state" role="status">Loading teams...</p></section> : <>
            <section className="content-card" aria-labelledby="rsvp-team-heading">
                <header className="content-card-header">
                    <h2 id="rsvp-team-heading">1. Choose a team</h2>
                    <span className="content-card-meta">{allowedTeams.length} teams</span>
                </header>
                <div className="form-field rsvp-team-search">
                    <label htmlFor="rsvp-team-search">Find a team</label>
                    <input id="rsvp-team-search" type="search" placeholder="Search team names" value={teamSearch}
                        onChange={(event) => setTeamSearch(event.target.value)} />
                </div>
                <div className="rsvp-choice-grid">
                    {visibleTeams.map((entry) => <button type="button" key={entry.id}
                        className="rsvp-choice" aria-pressed={teamId === String(entry.id)} disabled={saving}
                        onClick={() => chooseTeam(entry)}>
                        <strong>{entry.name}</strong>
                        <span>{(entry.team_members ?? []).length} players</span>
                        {teamId === String(entry.id) && <span className="rsvp-selected-label">Selected</span>}
                    </button>)}
                </div>
                {allowedTeams.length === 0 && <p className="empty-state">No teams available to manage.</p>}
                {allowedTeams.length > 0 && visibleTeams.length === 0 && <p className="empty-state">No teams match your search.</p>}
            </section>
            <section className="content-card" aria-labelledby="rsvp-game-heading">
                <header className="content-card-header">
                    <h2 id="rsvp-game-heading">2. Choose a game</h2>
                    {team && <label className="rsvp-check"><input type="checkbox" checked={showPastGames}
                        onChange={(event) => setShowPastGames(event.target.checked)} /> Include past games</label>}
                </header>
                {!team ? <p className="empty-state">Select a team above to see its schedule.</p> : <>
                    <div className="rsvp-choice-grid rsvp-game-list">
                        {visibleGames.map((entry) => <button type="button" key={entry.id}
                            className="rsvp-choice" aria-pressed={gameId === String(entry.id)} disabled={saving}
                            onClick={() => { setGameId(String(entry.id)); setResponses(null); setNotice(""); setError(""); }}>
                            <span>{formatGameDate(entry.game_date)} &middot; {formatGameTime(entry.start_time)}</span>
                            <strong>{entry.home_team_name ?? "TBD"} vs {entry.away_team_name ?? "TBD"}</strong>
                            <span>{[entry.location_name, entry.rink].filter(Boolean).join(" \u00b7 ") || "Location TBD"}</span>
                            {gameId === String(entry.id) && <span className="rsvp-selected-label">Selected</span>}
                        </button>)}
                    </div>
                    {visibleGames.length === 0 && <p className="empty-state">{teamGames.length === 0
                        ? "No games scheduled for this team."
                        : "No upcoming games. Include past games to view earlier matchups."}</p>}
                </>}
            </section>
            {team && <section className="content-card" aria-labelledby="rsvp-roster-heading" aria-busy={saving}>
                <header className="content-card-header">
                    <h2 id="rsvp-roster-heading">{team.name} &middot; Roster</h2>
                    <span className="content-card-meta">{players.length} players</span>
                </header>
                {game ? <div className="rsvp-game-summary">
                    <strong>{game.home_team_name ?? "TBD"} vs {game.away_team_name ?? "TBD"}</strong>
                    <span>{formatGameDate(game.game_date)} &middot; {formatGameTime(game.start_time)}</span>
                </div> : <p className="empty-state">Choose a game to edit attendance.{access.is_admin && " You can manage captains now."}</p>}
                {game && responses === null && !error && <p role="status">Loading RSVPs...</p>}
                {game && responses !== null && <div className="rsvp-totals" aria-label="Team attendance totals">
                    {ATTENDANCE_OPTIONS.map(({ value, label }) => <div key={value} className={`rsvp-total rsvp-status--${value}`}>
                        <strong>{players.filter((profile) => (responses[profile.id] ?? "pending") === value).length}</strong>
                        <span>{label}</span>
                    </div>)}
                </div>}
                <div className="rsvp-roster">
                    {players.map((profile) => {
                        const captain = captains.some((row) => String(row.team_id) === teamId && row.profile_id === profile.id);
                        return <article key={profile.id} className="rsvp-player">
                            <div className="rsvp-player-info">
                                <strong>{profile.full_name}</strong>
                                {access.is_admin ? <label className="rsvp-check"><input type="checkbox" checked={captain} disabled={saving}
                                    onChange={(event) => setCaptain(profile, event.target.checked)}
                                    aria-label={`Team captain: ${profile.full_name}`} /> Team captain</label>
                                    : <span>{captain ? "Team captain" : "Player"}</span>}
                            </div>
                            {game && responses !== null && <div className="rsvp-status-options" role="group" aria-label={`RSVP for ${profile.full_name}`}>
                                {ATTENDANCE_OPTIONS.map(({ value, label }) => <button type="button" key={value}
                                    className={`rsvp-status-button rsvp-status--${value}`}
                                    aria-pressed={(responses[profile.id] ?? "pending") === value} disabled={saving}
                                    onClick={() => saveRsvp(profile, value)}>{label}</button>)}
                            </div>}
                        </article>;
                    })}
                </div>
                {players.length === 0 && <p className="empty-state">No players on this team.</p>}
            </section>}
        </>}
    </div>;
}
