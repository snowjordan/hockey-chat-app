import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { loadAuthenticatedProfile } from "./lib/authHelpers.js";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import HockeyIcon from "./components/HockeyIcon.jsx";
import {
    demoLeague,
    CURRENT_USER_ID,
    CURRENT_TEAM_ID,
} from "./data/demoData.js";
import {
    FEED_TYPE_LABELS,
    getTeamName,
    getTeamNextGame,
    getOpponentName,
    formatNextGameShort,
    resolveRsvp,
    groupRosterByRsvp,
    countFieldSkaters,
    countNoResponse,
    rsvpLabel,
    formatSubStatus,
    isGoalieNeeded,
    buildNextGameContext,
    formatAttendanceDetail,
    getChatPrefill,
} from "./utils/gameHelpers.js";
import Directory from './components/Directory';
import ProfileEditor from './components/ProfileEditor';
import Login from './components/Login';
import SubsTab from './components/SubsTab';
import ProfileView from './components/ProfileView';

const league = demoLeague;

const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "schedule", label: "Schedule" },
    { id: "teams", label: "Teams" },
    { id: "directory", label: "Directory"},
    { id: "subs", label: "Subs"},
    { id: "notices", label: "League Notices" },
    { id: "chat", label: "Chat" },
];

function AttendanceHero({ going, rosterTotal }) {
    return (
        <div className="attendance-hero">
            <span className="attendance-hero-number">{going} skaters</span>
            {rosterTotal != null && (
                <span className="attendance-hero-secondary">{rosterTotal} rostered skaters</span>
            )}
        </div>
    );
}

function AttendancePills({ attendance }) {
    const { going = 0, maybe = 0, out = 0, noResponse = 0 } = attendance ?? {};
    return (
        <div className="attendance-pills">
            <span className="count count--going">Going <strong>{going}</strong></span>
            {maybe > 0 && <span className="count count--maybe">Maybe <strong>{maybe}</strong></span>}
            {out > 0 && <span className="count count--out">Out <strong>{out}</strong></span>}
            {noResponse > 0 && (
                <span className="count count--pending">No response <strong>{noResponse}</strong></span>
            )}
        </div>
    );
}

function AttendanceSummary({ attendance, rosterTotal, showBar = false }) {
    const { going = 0 } = attendance ?? {};

    return (
        <div className="attendance-summary">
            <AttendanceHero going={going} rosterTotal={rosterTotal} />
            <AttendancePills attendance={attendance} />
        </div>
    );
}

function RsvpControls({ value, onChange, size = "default" }) {
    return (
        <div className={`rsvp-controls rsvp-controls--${size}`}>
            {["going", "maybe", "out"].map((id) => (
                <button
                    key={id}
                    type="button"
                    className={`rsvp-btn rsvp-btn--${id}${value === id ? " is-active" : ""}`}
                    onClick={() => onChange(id)}
                >
                    {rsvpLabel(id)}
                </button>
            ))}
        </div>
    );
}

function LeagueFeed({ items, limit, expandedId, onToggle, title = "League Feed" }) {
    const visible = limit ? items.slice(0, limit) : items;

    return (
        <section className="content-card feed-card">
            <header className="content-card-header">
                <h2>{title}</h2>
            </header>
            {visible.length === 0 ? (
                <p className="empty-state">No league activity yet.</p>
            ) : (
                <ul className="feed-list">
                    {visible.map((item) => {
                        const expanded = expandedId === item.id;
                        return (
                            <li key={item.id} className={`feed-item feed-item--${item.type}`}>
                                <button
                                    type="button"
                                    className="feed-item-toggle"
                                    onClick={() => onToggle?.(expanded ? null : item.id)}
                                    aria-expanded={expanded}
                                >
                                    <span className="feed-badge">{FEED_TYPE_LABELS[item.type] ?? item.type}</span>
                                    <span className="feed-body">{item.message}</span>
                                    <time className="feed-date">{item.date}</time>
                                    {onToggle && (
                                        expanded
                                            ? <IconChevronDown size={14} className="feed-chevron" />
                                            : <IconChevronRight size={14} className="feed-chevron" />
                                    )}
                                </button>
                                {expanded && (
                                    <div className="feed-expanded">
                                        <strong>{item.title}</strong>
                                        <p>{item.message}</p>
                                        <span className="feed-expanded-date">Posted {item.date}</span>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function TonightsRoster({ game, teams = [], userRsvp, onPromptPlayers }) {
    const myTeam =
        teams.find((team) => team.id === CURRENT_TEAM_ID) ??
        teams.find((team) => team.name === "Red Bricks") ??
        teams[0]

    const players = myTeam?.team_members ?? myTeam?.roster ?? []

    if (!game) {
        return (
            <aside className="right-rail">
                <h3 className="rail-heading">Tonight&apos;s Roster</h3>
                <p className="rail-empty">No upcoming game.</p>
            </aside>
        )
    }

    if (players.length === 0) {
        return (
            <aside className="right-rail">
                <h3 className="rail-heading">Tonight&apos;s Roster</h3>
                <p className="rail-empty">No roster loaded yet.</p>
            </aside>
        )
    }

    return (
        <aside className="right-rail">
            <h3 className="rail-heading">Tonight&apos;s Roster</h3>

            <ul className="rail-roster-list">
                {players.map((player) => {
                    const playerName =
                        player.profiles?.full_name ??
                        player.name ??
                        "Unknown player"

                    const status = resolveRsvp(
                        player,
                        userRsvp,
                        CURRENT_USER_ID
                    )

                    return (
                        <li
                            key={player.id ?? playerName}
                            className="rail-roster-item"
                        >
                            <span>{playerName}</span>
                            <span>{rsvpLabel(status)}</span>
                        </li>
                    )
                })}
            </ul>

            {onPromptPlayers && (
                <button
                    type="button"
                    className="action-btn action-btn--outline"
                    onClick={onPromptPlayers}
                >
                    Prompt No Response
                </button>
            )}
        </aside>
    )
}

function GameDetailModal({ game, onClose, onMessageTeam, onRequestSub }) {
    const home = game.home_team_name ?? 'TBD';
    const away = game.away_team_name ?? 'TBD';
    const date = formatGameDate(game.game_date);
    const startTime = formatGameTime(game.start_time);
    const endTime = formatGameTime(game.end_time);
    const time = `${startTime} – ${endTime}`;
    const rink = `${game.location_name ?? 'TBD'}${game.rink ? ` · ${game.rink}` : ''}`;

    return (
        <div className="modal-backdrop">
            <div className="modal-card game-detail-modal">
                <header className="modal-header">
                    <h3>{home} vs {away}</h3>
                    <button type="button" className="modal-close" onClick={onClose}>Close</button>
                </header>

                <div className="game-detail-list">
                    <div><span>Date</span><strong>{date}</strong></div>
                    <div><span>Time</span><strong>{time}</strong></div>
                    <div><span>Rink</span><strong>{rink}</strong></div>
                    <div><span>Attendance</span><strong>0 going · 0 maybe · 0 out</strong></div>
                    <div><span>Goalie</span><strong>Scheduled</strong></div>
                    <div><span>Subs</span><strong>No subs needed</strong></div>
                </div>

                <footer className="modal-actions">
                    <button type="button" className="action-btn action-btn--primary" onClick={onMessageTeam}>Message Team</button>
                    <button type="button" className="action-btn action-btn--secondary" onClick={onRequestSub}>Request Sub</button>
                </footer>
            </div>
        </div>
    );
}
function App() {
    const [session, setSession] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [activeView, setActiveView] = useState("dashboard");
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [editingPlayer, setEditingPlayer] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [activeChatId, setActiveChatId] = useState(league.chats[0].id);
    const [userRsvp, setUserRsvp] = useState("going");
    const [subRequested, setSubRequested] = useState(false);
    const [teamAttendance, setTeamAttendance] = useState(
        league.teams.find((t) => t.id === CURRENT_TEAM_ID).attendance
    );
    const [chatMessages, setChatMessages] = useState(() =>
        Object.fromEntries(league.chats.map((c) => [c.id, [...c.messages]]))
    );
    const [chatDraft, setChatDraft] = useState("");
    const [expandedFeedId, setExpandedFeedId] = useState(null);
    const [expandedNoticeId, setExpandedNoticeId] = useState(null);

    const [upcomingGames, setUpcomingGames] = useState([]);
    const [nextGameIndex, setNextGameIndex] = useState(0);

    const [teams, setTeams] = useState([]);

    useEffect(() => {
        let isMounted = true
        let authCheckNumber = 0

        async function processSession(nextSession) {
            const currentCheck = ++authCheckNumber

            if (!isMounted) {
                return
            }

            setSession(nextSession)
            setCurrentProfile(null)
            setAccessDenied(false)
            setAuthLoading(true)

            if (!nextSession?.user) {
                setAuthLoading(false)
                return
            }

            console.log("Checking authenticated user:", {
                id: nextSession.user.id,
                email: nextSession.user.email,
            })

            const { profile, error } = await loadAuthenticatedProfile(nextSession.user.id)
            
            
            // Ignore this result if another authentication check started, while the database request was running.

            if (!isMounted || currentCheck !== authCheckNumber) {
                return
            }

            console.log("Authenticated profile result:", profile)

            if (error) {
                console.error(
                    "Unable to check profile access",
                    error
                )

                setCurrentProfile(null)
                setAccessDenied(true)
                setAuthLoading(false)
                return
            }

            if (!profile) {
                console.warn(
                    "Access denied: no profile is linked to",
                    nextSession.user.id
                )

                setCurrentProfile(null)
                setAccessDenied(true)
                setAuthLoading(false)
                return
            }

            setCurrentProfile(profile)
            setAccessDenied(false)
            setActiveView('dashboard')
            setAuthLoading(false)
        }
        
        async function initializeAuth() {
            const { data: {session: initialSession}, error } = await supabase.auth.getSession()

            if (error) {
                console.error(
                    "Unable to restore authentication session:",
                    error
                )

                if (isMounted) {
                    setSession(null)
                    setCurrentProfile(null)
                    setAuthLoading(false)
                }

                return
            }

            await processSession(initialSession)
        }

        initializeAuth()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(
            (_event, nextSession) => {
                processSession(nextSession)
            }
        )

        return () => {
            isMounted = false
            authCheckNumber += 1
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        if (!currentProfile) {
            setTeams([])
            return
        }

        async function loadTeams() {
            const { data, error } = await supabase
                .from("teams")
                .select(`
                    id,
                    name,
                    league_name,
                    team_members (
                        id,
                        jersey_number,
                        position,
                        profiles!inner (
                            id,
                            full_name,
                            email,
                            phone,
                            notes,
                            auth_user_id
                        )
                    )
                `)
                .eq("team_members.profiles.is_system_account", false)
                .order("name")

            if (error) {
                console.error("Error loading teams:", error)
                return
            }

            setTeams(data ?? [])
        }

        loadTeams()
    }, [currentProfile])

    useEffect(() => {
        if (!currentProfile) {
            return
        }

        async function loadUpcomingGames() {

            const { data, error } = await supabase
                .from('games')
                .select('*')
                .order('starts_at', { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setUpcomingGames(data ?? []);
        }

        loadUpcomingGames();
    }, [currentProfile]);

    const upcomingGame = upcomingGames[nextGameIndex];
    console.log('upcomingGames length', upcomingGames.length);
    const rawMyTeam = teams.find((t) => t.name === "Red Bricks") ?? teams[0];

    const myTeam = rawMyTeam
      ? {
            ...rawMyTeam,
            roster: rawMyTeam.team_members ?? [],
        }
      : null;

    const gameContext = buildNextGameContext({
        game: upcomingGame,
        myTeam,
        teams: teams,
        attendance: {
            ...teamAttendance,
            noResponse: countNoResponse(myTeam?.roster ?? [], userRsvp, CURRENT_USER_ID),
        },
        subRequested,
        userRsvp,
        currentUserId: CURRENT_USER_ID,
    });

    const handleRsvp = (status) => {
        const prev = userRsvp;
        setUserRsvp(status);
        if (prev === status) return;
        setTeamAttendance((current) => {
            const next = { ...current };
            if (prev && prev !== "pending") next[prev] = Math.max(0, (next[prev] ?? 0) - 1);
            next[status] = (next[status] ?? 0) + 1;
            return next;
        });
    };

    const navigateTo = (view) => {
        setActiveView(view)
        setEditingPlayer(false)

        if (view !== "teams") {
            setSelectedTeam(null)
            setSelectedPlayer(null)
        }
    }

    const openTeam = (team) => {
        setSelectedTeam(team)
        setSelectedPlayer(null)
        setEditingPlayer(false)
        setActiveView("teams")
    }

    const openPlayer = (player) => {
        setSelectedPlayer(player)
        setEditingPlayer(false)
    }

    const openChat = (prefill = "") => {
        setActiveView("chat");
        if (prefill) setChatDraft(prefill);
    };

    const promptNoResponse = () => openChat(getChatPrefill("prompt", gameContext));

    async function signOut() {
        const { error } = await supabase.auth.signOut()

        if (error) {
            console.error("Sign out error:", error.message)
        }
    }

    const sendChatMessage = () => {
        const text = chatDraft.trim();
        if (!text) return;
        setChatMessages((prev) => ({
            ...prev,
            [activeChatId]: [
                ...(prev[activeChatId] ?? []),
                { id: `msg-${Date.now()}`, text, type: "outgoing" },
            ],
        }));
        setChatDraft("");
    };

    const feedItems = league.feed ?? league.alerts.map((a) => ({ ...a, type: "schedule_change" }));

    const mainContent = (() => {
        if (selectedPlayer && selectedTeam) {
            const profile = selectedPlayer.profiles

            if (!profile?.id) {
                return (
                    <div className="page-view player-detail-view">
                        <button
                            type="button"
                            className="back-button"
                            onClick={() => {
                                setSelectedPlayer(null)
                                setEditingPlayer(false)
                            }}
                        >
                            ← Back to roster
                        </button>

                        <section className="content-card">
                            <p className="empty-state">
                                This roster member does not have a profile yet.
                            </p>
                        </section>
                    </div>
                )
            }

            const isOwnProfile = currentProfile?.id === profile.id

            const isAdmin = currentProfile?.is_admin === true

            const canEditProfile = isOwnProfile || isAdmin

            if (editingPlayer && canEditProfile) {
                return (
                    <ProfileEditor
                        profile={profile}
                        onBack={() => setEditingPlayer(false)}
                        onSaved={() => {
                            setEditingPlayer(false)
                            setSelectedPlayer(null)
                            setSelectedTeam(null)
                        }}
                    />
                )
            }

            return (
                <ProfileView
                    profile={profile}
                    currentProfile={currentProfile}
                    onBack={() => {
                        setSelectedPlayer(null)
                        setEditingPlayer(false)
                    }}
                    onEdit={
                        canEditProfile
                            ? () => setEditingPlayer(true)
                            : undefined
                    }
                />
            )
        }

        if (selectedTeam && activeView === "teams") {
            return (
                <TeamDetail
                    team={selectedTeam}
                    league={league}
                    userRsvp={userRsvp}
                    onBack={() => {
                        setSelectedTeam(null)
                        setSelectedPlayer(null)
                        setEditingPlayer(false)
                    }}
                    onSelectPlayer={openPlayer}
                />
            )
        }

        switch (activeView) {
            case "dashboard":
                return (
                    <DashboardView
                        gameContext={gameContext}
                        myTeam={myTeam}
                        userRsvp={userRsvp}
                        onRsvp={handleRsvp}
                        subRequested={subRequested}
                        onRequestSub={() => {
                            setSubRequested(true)
                            openChat(getChatPrefill("sub", gameContext))
                        }}
                        onMessageTeam={() =>
                            openChat(getChatPrefill("game", gameContext))
                        }
                        onPromptNoResponse={promptNoResponse}
                        onOpenTeam={openTeam}
                        feedItems={feedItems}
                        expandedFeedId={expandedFeedId}
                        onToggleFeed={setExpandedFeedId}
                        teams={teams}
                        games={upcomingGames}
                    />
                )

            case "schedule":
                return (
                    <ScheduleView
                        league={league}
                        userRsvp={userRsvp}
                        onRsvp={handleRsvp}
                        gameContext={gameContext}
                        onMessageTeam={() =>
                            openChat(getChatPrefill("game", gameContext))
                        }
                        onRequestSub={() => {
                            setSubRequested(true)
                            openChat(getChatPrefill("sub", gameContext))
                        }}
                    />
                )

            case "teams":
                return (
                    <TeamsView
                        teams={teams}
                        onSelectTeam={openTeam}
                    />
                )

            case "directory":
                return <Directory />

            case "subs":
                return <SubsTab />

            case "notices":
                return (
                    <NoticesView
                        league={league}
                        feedItems={feedItems}
                        expandedNoticeId={expandedNoticeId}
                        onToggleNotice={setExpandedNoticeId}
                        expandedFeedId={expandedFeedId}
                        onToggleFeed={setExpandedFeedId}
                        onViewGame={() => navigateTo("schedule")}
                    />
                )

            case "chat":
                return (
                    <ChatView
                        league={league}
                        activeChatId={activeChatId}
                        onSelectChat={setActiveChatId}
                        messages={chatMessages[activeChatId] ?? []}
                        draft={chatDraft}
                        onDraftChange={setChatDraft}
                        onSend={sendChatMessage}
                        gameContext={gameContext}
                        onRequestSub={() => {
                            setSubRequested(true)
                            setChatDraft(
                                getChatPrefill("sub", gameContext)
                            )
                        }}
                        onAskGoalie={() =>
                            setChatDraft(
                                getChatPrefill("goalie", gameContext)
                            )
                        }
                        onMessageGame={() =>
                            setChatDraft(
                                getChatPrefill("game", gameContext)
                            )
                        }
                        onPromptNoResponse={() =>
                            setChatDraft(
                                getChatPrefill("prompt", gameContext)
                            )
                        }
                    />
                )

            default:
                return null
        }
    })()

    if (authLoading) {
        return <p>Checking account...</p>;
    }

    if (!session) {
        return <Login />;
    }

    if (!currentProfile) {
        return <Login accessDenied={accessDenied} />
    }

    return (
        <div className="app-layout">
            <header className="app-bar">
                <div className="app-bar-brand">
                    <HockeyIcon size={22} className="app-bar-icon" />
                    <div>
                        <h1 className="app-bar-title">Hockey League</h1>
                        <span className="app-bar-subtitle">{league.name} · Season 2026</span>
                    </div>
                </div>
                {gameContext && (
                    <div className="app-bar-ribbon" aria-label="Next game status">
                        <span className="ribbon-meta-label">Next Game</span>
                        <span className="ribbon-vdivider" aria-hidden="true" />

                        <button
                            type="button"
                            className="next-game-arrow"
                            onClick={() => {
                                console.log('prev clicked');
                                setNextGameIndex((index) =>
                                    index === 0 ? upcomingGames.length - 1 : index - 1
                                );
                            }}
                            disabled={upcomingGames.length <= 1}
                        >
                            ‹
                        </button>
                        <span className="ribbon-matchup">{gameContext.matchup}</span>

                        {[gameContext.date, gameContext.time, gameContext.rink].map((item) => (
                            <span key={item} className="ribbon-meta-group">
                                <span className="ribbon-vdivider" aria-hidden="true" />
                                <span className="ribbon-meta">{item}</span>
                            </span>
                         ))}

                         <button
                            type="button"
                            className="next-game-arrow"
                            onClick={() => {
                                console.log('next clicked'); 
                                setNextGameIndex((index) =>
                                    index === upcomingGames.length - 1 ? 0 : index + 1
                                )
                            }}
                            disabled={upcomingGames.length <= 1}
                        >
                            ›
                        </button>

                    </div>
                )}

                <button
                            type="button"
                            className="sign-out-button"
                            onClick={signOut}
                        >
                            Sign out
                        </button>
            </header>

            <div className="app-body">
                <nav className="sidebar">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`sidebar-link${activeView === item.id ? " is-active" : ""}`}
                            onClick={() => navigateTo(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <main className="main-content">{mainContent}</main>

                {!selectedPlayer && (
                    <TonightsRoster
                    game={upcomingGame}
                    teams={teams}
                    userRsvp={userRsvp}
                    onPromptPlayers={promptNoResponse}
                />
                )}
            </div>
        </div>
    );
}

function DashboardView({
    gameContext,
    myTeam,
    userRsvp,
    onRsvp,
    subRequested,
    onRequestSub,
    onMessageTeam,
    onPromptNoResponse,
    onOpenTeam,
    feedItems,
    expandedFeedId,
    onToggleFeed,
    teams,
    games,
}) {
    const subStatus = formatSubStatus(myTeam?.substituteStatus, subRequested);
    const noResponse = countNoResponse(myTeam?.roster ?? [], userRsvp, CURRENT_USER_ID);
    const attendanceDetail = gameContext ? formatAttendanceDetail(gameContext) : "";

    return (
        <div className="page-view dashboard-view">
            <header className="page-header">
                <h2>Dashboard</h2>
            </header>

            <div className="dashboard-grid">
                {gameContext ? (
                    <section className="content-card next-game-card content-card--hero">
                        <header className="content-card-header"><h2>Next Game</h2></header>
                        <div className="next-game-columns">
                            <div className="next-game-col next-game-col--info">
                                <div className="next-game-matchup">{gameContext.matchup}</div>
                                <p className="next-game-when">
                                    {gameContext.date} · {gameContext.time} · {gameContext.rink}
                                </p>
                            </div>
                            <div className="next-game-col next-game-col--attendance">
                                <span className="attendance-hero-number">{gameContext.skatersGoing} skaters</span>
                                {attendanceDetail && (
                                    <p className="attendance-detail-line">{attendanceDetail}</p>
                                )}
                                <p className="attendance-status-line">
                                    {gameContext.goalieStatus}
                                    {gameContext.subsNeeded && ` · ${subStatus}`}
                                </p>
                            </div>
                            <div className="next-game-col next-game-col--actions">
                                <span className="col-label">Your Status</span>
                                <p className="your-status">
                                    Currently <strong className={`text-${userRsvp}`}>{rsvpLabel(userRsvp)}</strong>
                                </p>
                                <RsvpControls value={userRsvp} onChange={onRsvp} size="large" />
                                <div className="action-stack">
                                    <button type="button" className="action-btn action-btn--primary" onClick={onMessageTeam}>Message Team</button>
                                    <button type="button" className="action-btn action-btn--outline" onClick={onRequestSub}>Request Sub</button>
                                    {noResponse > 0 && (
                                        <button type="button" className="action-btn action-btn--outline" onClick={onPromptNoResponse}>Prompt No Response</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="content-card"><p className="empty-state">No upcoming games.</p></section>
                )}

                <LeagueFeed
                    items={feedItems}
                    limit={4}
                    expandedId={expandedFeedId}
                    onToggle={onToggleFeed}
                    title="Recent Updates"
                />

                <section className="content-card teams-overview">
                    <header className="content-card-header">
                        <h2>Teams</h2>
                    </header>
                    <div className="teams-grid">
                        {teams.map((team) => (
                            <TeamCard
                                key={team.id}
                                team={team}
                                games={games}
                                teams={teams}
                                onSelect={onOpenTeam}
                                compact
                            />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

function TeamCard({ team, games, teams, onSelect, compact = false }) {
    const roster = team.team_members ?? [];

    const forwards = roster.filter((member) => member.position === "Forward").length;
    const defense = roster.filter((member) => member.position === "Defense").length;
    const goalies = roster.filter((member) => member.position === "Goalie").length;

    return (
        <article className="team-card team-card--clickable">
            <div className="team-card-head">
                <h3 className="team-card-name">{team.name}</h3>
                <span className="team-card-count">{roster.length} players</span>
            </div>

            <p className="team-card-next">
                Forwards: {forwards} · Defense: {defense} · Goalies: {goalies}
            </p>

            <button
                type="button"
                className="team-card-link"
                onClick={() => onSelect(team)}
            >
                View roster →
            </button>
        </article>
    );
}

function formatGameDate(dateString) {
    if (!dateString) return 'TBD';

    const [year, month, day] = dateString.split('-').map(Number);

    if (!year || !month || !day) {
        return dateString;
    }

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function formatGameTime(timeString) {
    if (!timeString) return 'TBD';

    const [hours, minutes] = timeString.split(':').map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return timeString;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function ScheduleView({ league, userRsvp, onRsvp, gameContext, onMessageTeam, onRequestSub }) {
    const [games, setGames] = useState([])
    const [detailGame, setDetailGame] = useState(null);
    const [rsvpGameId, setRsvpGameId] = useState(null);

    useEffect(() => {
        async function loadGames() {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .order('starts_at', { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setGames(data);
        }

        loadGames();
    }, []);

    return (
        <div className="page-view schedule-view">
            <header className="page-header">
                <h2>Schedule</h2>
                <p className="page-subtitle">{games.length} games · South Suburban Sports Complex</p>
            </header>

            <section className="content-card schedule-table">
                <div className="schedule-table-head">
                    <span>Date</span><span>Time</span><span>Matchup</span><span>Rink</span>
                    <span>RSVP</span><span>Status</span><span></span>
                </div>
                {games.map((game) => {
                    const home = game.home_team_name;
                    const away = game.away_team_name;
                    const going = 0;
                    const maybe = 0;
                    const out = 0;
                    const showRsvp = rsvpGameId === game.id;

                    return (
                        <div key={game.id}>
                            <div className="schedule-table-row">
                                <span className="schedule-date">{formatGameDate(game.game_date)}</span>
                                <span className="schedule-time">{formatGameTime(game.start_time)}</span>
                                <span className="schedule-teams">{home} vs {away}</span>
                                <span className="schedule-rink">
                                    {game.location_name}{game.rink ? ` · ${game.rink}` : ''}
                                </span>
                                <span className="schedule-rsvp">{going}G · {maybe}M · {out}O</span>
                                <span className="schedule-status">
                                    <span className="status-tag status-tag--ok">Scheduled</span>
                                    {game.substituteStatus !== "None" && game.substituteStatus !== "No subs needed" && (
                                        <span className="status-tag status-tag--warn">{game.substituteStatus}</span>
                                    )}
                                </span>
                                <span className="schedule-actions">
                                    <button type="button" className="action-btn action-btn--secondary action-btn--schedule" onClick={() => setDetailGame(game)}>Details</button>
                                    <button type="button" className="action-btn action-btn--secondary action-btn--schedule" onClick={() => setRsvpGameId(showRsvp ? null : game.id)}>RSVP</button>
                                </span>
                            </div>
                            {showRsvp && (
                                <div className="schedule-rsvp-panel">
                                    <span className="col-label">Your RSVP for {formatGameDate(game.game_date)}</span>
                                    <RsvpControls value={userRsvp} onChange={onRsvp} />
                                    <p className="card-note">You are marked: <strong className={`text-${userRsvp}`}>{rsvpLabel(userRsvp)}</strong></p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>

            {detailGame && (
                <GameDetailModal
                    game={detailGame}
                    onClose={() => setDetailGame(null)}
                    onMessageTeam={() => {
                         setDetailGame(null); 
                         onMessageTeam(); 
                    }}
                    onRequestSub={() => { 
                        setDetailGame(null); 
                        onRequestSub(); 
                    }}
                />
            )}
        </div>
    );
}

function TeamsView({ teams = [], onSelectTeam }) {
    return (
        <div className="page-view teams-view">
            <header className="page-header">
                <h2>Teams</h2>
                <p className="page-subtitle">
                    League teams and player rosters
                </p>
            </header>

            <div className="teams-grid teams-grid--page">
                {teams.map((team) => (
                    <TeamCard
                        key={team.id}
                        team={team}
                        onSelect={onSelectTeam}
                    />
                ))}
            </div>
        </div>
    )
}

function TeamDetail({ team, league, userRsvp, onBack, onSelectPlayer }) {
    const roster = Array.isArray(team?.team_members)
    ? [...team.team_members].sort((a, b) => {
        const aName = a.profiles?.full_name ?? '';
        const bName = b.profiles?.full_name ?? '';

        return aName.localeCompare(bName);
       })
    :  []



    return (
        <div className="page-view team-detail-view">
            <button type="button" className="back-button" onClick={onBack}>← Back to teams</button>

            <header className="page-header">
                <h2>{team.name}</h2>
                <p className="page-subtitle">{roster.length} players</p>
            </header>


            <section className="content-card roster-card">
                <header className="content-card-header"><h2>Roster</h2></header>
                <table className="roster-table">
                    <thead>
                        <tr><th>Name</th><th>#</th><th>Position</th></tr>
                    </thead>
                    <tbody>
                        {roster.map((member) => (
                                <tr key={member.id} onClick={() => onSelectPlayer(member)}>
                                    <td className="roster-name">{member.profiles?.full_name ?? 'Unknown player'}</td>
                                    <td>{member.jersey_number}</td>
                                    <td>{member.position}</td>
                                </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function PlayerDetail({ player, userRsvp, onBack }) {
    const status = resolveRsvp(player, userRsvp, CURRENT_USER_ID);
    return (
        <div className="page-view player-detail-view">
            <button type="button" className="back-button" onClick={onBack}>← Back to roster</button>
            <header className="page-header">
                <h2>{player.name}</h2>
                <p className="page-subtitle">#{player.number} · {player.position}{player.isGoalie ? " · Goalie" : ""}</p>
            </header>
            <section className="content-card">
                <header className="content-card-header"><h2>Contact</h2></header>
                <dl className="detail-dl">
                    <div><dt>Phone</dt><dd>{player.phone}</dd></div>
                    <div><dt>Email</dt><dd>{player.email}</dd></div>
                    <div><dt>Notes</dt><dd>{player.notes || "No notes yet"}</dd></div>
                </dl>
            </section>
        </div>
    );
}

function NoticesView({ league, feedItems, expandedNoticeId, onToggleNotice, expandedFeedId, onToggleFeed, onViewGame }) {
    return (
        <div className="page-view notices-view">
            <header className="page-header">
                <h2>League Notices</h2>
                <p className="page-subtitle">Official announcements and schedule changes</p>
            </header>
            <section className="content-card">
                <header className="content-card-header">
                    <h2>Announcements</h2>
                    <span className="content-card-meta">{league.alerts.length} notices</span>
                </header>
                {league.alerts.map((alert) => {
                    const expanded = expandedNoticeId === alert.id;
                    return (
                        <div key={alert.id} className="notice-expandable">
                            <button type="button" className="notice-toggle" onClick={() => onToggleNotice(expanded ? null : alert.id)}>
                                <time className="notice-date">{alert.date}</time>
                                <strong className="notice-title">{alert.title}</strong>
                                <span className="notice-summary">{alert.summary ?? alert.message}</span>
                                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </button>
                            {expanded && (
                                <div className="notice-expanded">
                                    <p className="notice-message">{alert.message}</p>
                                    <span className="notice-meta">Posted {alert.date}</span>
                                    {alert.relatedGameId && (
                                        <button type="button" className="action-btn action-btn--ghost action-btn--sm" onClick={onViewGame}>View game</button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
            <LeagueFeed items={feedItems} expandedId={expandedFeedId} onToggle={onToggleFeed} />
        </div>
    );
}

function ChatView({
    league,
    activeChatId,
    onSelectChat,
    messages,
    draft,
    onDraftChange,
    onSend,
    gameContext,
    onRequestSub,
    onAskGoalie,
    onMessageGame,
    onPromptNoResponse,
}) {
    const chat = league.chats.find((c) => c.id === activeChatId) ?? league.chats[0];

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="page-view chat-page">
            <div className="chat-workspace">
                <aside className="chat-channels">
                    <header className="chat-channels-header">Channels</header>
                    {league.chats.map((ch) => (
                        <button
                            key={ch.id}
                            type="button"
                            className={`chat-channel${ch.id === activeChatId ? " is-active" : ""}`}
                            onClick={() => onSelectChat(ch.id)}
                        >
                            #{ch.name}
                        </button>
                    ))}
                </aside>
                <div className="chat-main">
                    <header className="chat-main-header"><h2>#{chat.name}</h2></header>
                    <div className="chat-messages">
                        {gameContext && (
                            <section className="chat-context-card">
                                <h4>Game context</h4>
                                <p><strong>{gameContext.matchup}</strong> · {gameContext.date} · {gameContext.time}</p>
                                <p>{gameContext.rink} · {gameContext.skatersGoing} skaters · {gameContext.goalieStatus} · {gameContext.subStatus}</p>
                                <div className="chat-quick-links">
                                    <button type="button" className="action-btn action-btn--ghost action-btn--sm" onClick={onMessageGame}>Message about next game</button>
                                    <button type="button" className="action-btn action-btn--ghost action-btn--sm" onClick={onRequestSub}>Request sub</button>
                                    {gameContext.noResponse > 0 && (
                                        <button type="button" className="action-btn action-btn--ghost action-btn--sm" onClick={onPromptNoResponse}>Prompt no response</button>
                                    )}
                                    {!gameContext.goalieOk && (
                                        <button type="button" className="action-btn action-btn--ghost action-btn--sm" onClick={onAskGoalie}>Ask for goalie</button>
                                    )}
                                </div>
                            </section>
                        )}
                        {messages.length === 0 ? (
                            <p className="chat-empty-text">No messages yet. Use quick actions above or type below.</p>
                        ) : (
                            messages.map((message) => (
                                <div key={message.id} className={`chat-bubble chat-bubble--${message.type ?? "incoming"}`}>
                                    {message.text}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="chat-composer">
                        <input
                            className="chat-input"
                            type="text"
                            placeholder={`Message #${chat.name}`}
                            value={draft}
                            onChange={(e) => onDraftChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button type="button" className="action-btn action-btn--primary" onClick={onSend}>Send</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
