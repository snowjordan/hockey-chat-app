import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { loadAuthenticatedProfile } from "./lib/authHelpers.js";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import HockeyIcon from "./components/HockeyIcon.jsx";
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
import SetPassword from './components/SetPassword'


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

                        const attendanceStatusClass =
                            item.type === "attendance_update"
                                ? item.message.includes("marked Going")
                                    ? "feed-item--going"
                                    : item.message.includes("marked Maybe")
                                    ? "feed-item--maybe"
                                    : item.message.includes("marked Out")
                                    ? "feed-item--out"
                                    : ""
                                : "";

                        return (
                            <li 
                                key={item.id} 
                                className={`feed-item feed-item--${item.type} ${attendanceStatusClass}`}
                            >
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

function TonightsRoster({ game, teams = [], userRsvp, currentUserId, onPromptPlayers }) {
    const myTeam =
        teams.find((team) =>
            (team.team_members ?? []).some((member) =>
                member.profile_id === currentUserId ||
                member.profiles?.id === currentUserId
            )
        ) ?? null

    const players =
        myTeam?.team_members ??
        myTeam?.roster ??
        []

    if (!game) {
        return (
            <aside className="right-rail">
                <h3 className="rail-heading">Tonight&apos;s Roster</h3>
                <p className="rail-empty">No upcoming game.</p>
            </aside>
        )
    }

    if (!myTeam) {
        return (
            <aside className="right-rail">
                <h3 className="rail-heading">
                    Tonight&apos;s Roster
                </h3>
                <p className="rail-empty">
                    No team is associated with this profile.
                </p>
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
                        currentUserId
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
    const [activeChatId, setActiveChatId] = useState(null);
    const [userRsvp, setUserRsvp] = useState("pending");
    const [subRequested, setSubRequested] = useState(false);
    const [teamAttendance, setTeamAttendance] = useState({
        going: 0,
        maybe: 0,
        out: 0,
        noResponse: 0,
    });
    const [mobileRsvpsByGame, setMobileRsvpsByGame] = useState({});
    const [mobileAttendanceByGame, setMobileAttendanceByGame] = useState({});

    const [chatMessages, setChatMessages] = useState({});
    const [chats, setChats] = useState([]);
    const [chatDraft, setChatDraft] = useState("");
    const [expandedFeedId, setExpandedFeedId] = useState(null);
    const [expandedNoticeId, setExpandedNoticeId] = useState(null);

    const [upcomingGames, setUpcomingGames] = useState([]);
    const [nextGameIndex, setNextGameIndex] = useState(0);

    const [leagueAlerts, setLeagueAlerts] = useState([]);
    const [leagueAlertsLoading, setLeagueAlertsLoading] = useState(false);
    const [leagueAlertsError, setLeagueAlertsError] = useState("");

    const [announcementFormOpen, setAnnouncementFormOpen] =
    useState(false)

    const [announcementDraft, setAnnouncementDraft] = useState({
        title: "",
        summary: "",
        message: "",
    })

    const [announcementSubmitting, setAnnouncementSubmitting] =
        useState(false)

    const [announcementSubmitError, setAnnouncementSubmitError] =
        useState("")

    const [feedItems, setFeedItems] = useState([]);
    const [feedLoading, setFeedLoading] = useState(false)
    const [feedError, setFeedError] = useState("")

    const [teams, setTeams] = useState([]);

    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const searchParams = new URLSearchParams(window.location.search)

    const isSetPasswordPage = window.location.pathname === "/set-password" || searchParams.get("page") === "set-password"

    const currentTeamId =
        teams.find((team) =>
            team.team_members?.some(
                (member) => member.profile_id === currentProfile?.id
            )
        )?.id ?? null

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

            let {
                profile,
                error,
            } = await loadAuthenticatedProfile(nextSession.user.id)

            // Ignore this result if another authentication check started
            // while the database request was running.
            if (!isMounted || currentCheck !== authCheckNumber) {
                return
            }

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

            // A profile may exist for this email but not yet be linked
            // to the newly authenticated Supabase user.
            if (!profile) {
                console.log(
                    "No linked profile found. Attempting automatic profile connection."
                )

                const {
                    data: linkResult,
                    error: linkError,
                } = await supabase.rpc(
                    "link_authenticated_profile"
                )

                // Ignore this result if another authentication check started
                // while the profile-linking request was running.
                if (!isMounted || currentCheck !== authCheckNumber) {
                    return
                }

                if (linkError) {
                    console.error(
                        "Unable to connect authenticated user to profile",
                        linkError
                    )

                    setCurrentProfile(null)
                    setAccessDenied(true)
                    setAuthLoading(false)
                    return
                }

                console.log(
                    "Profile connection result:",
                    linkResult
                )

                const linkSucceeded =
                    linkResult?.status === "linked" ||
                    linkResult?.status === "already_linked"

                if (!linkSucceeded) {
                    console.warn(
                        "Access denied: profile could not be connected",
                        linkResult?.status
                    )

                    setCurrentProfile(null)
                    setAccessDenied(true)
                    setAuthLoading(false)
                    return
                }

                const linkedProfileResult =
                    await loadAuthenticatedProfile(
                        nextSession.user.id
                    )

                // Ignore this result if another authentication check started
                // while the linked profile was being loaded.
                if (!isMounted || currentCheck !== authCheckNumber) {
                    return
                }

                profile = linkedProfileResult.profile
                error = linkedProfileResult.error

                if (error || !profile) {
                    console.error(
                        "Profile was connected, but could not be loaded",
                        error
                    )

                    setCurrentProfile(null)
                    setAccessDenied(true)
                    setAuthLoading(false)
                    return
                }
            }

            setCurrentProfile(profile)
            setAccessDenied(false)
            setActiveView("dashboard")
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

    async function loadLeagueAlerts(leagueName) {
        if (!leagueName) {
            setLeagueAlerts([]);
            return;
        }

        setLeagueAlertsLoading(true);
        setLeagueAlertsError("");

        const { data, error } = await supabase
            .from("announcements")
            .select(`
                id,
                title,
                summary,
                message,
                related_game_id,
                created_at
            `)
            .eq("league_name", leagueName)
            .is("team_id", null)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Unable to load league announcements:", error);
            setLeagueAlerts([]);
            setLeagueAlertsError("Unable to load league announcements.");
            setLeagueAlertsLoading(false);
            return;
        }

        const formattedAlerts = (data ?? []).map((announcement) => ({
            id: announcement.id,
            title: announcement.title,
            summary: announcement.summary,
            message: announcement.message,
            relatedGameId: announcement.related_game_id,
            date: new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
            }).format(new Date(announcement.created_at)),
        }));

        setLeagueAlerts(formattedAlerts);
        setLeagueAlertsLoading(false);
    }

    async function handleCreateAnnouncement(event) {
        event.preventDefault()

        const title = announcementDraft.title.trim()
        const summary = announcementDraft.summary.trim()
        const message = announcementDraft.message.trim()

        if (currentProfile?.is_admin !== true) {
            setAnnouncementSubmitError(
                "You do not have permission to create announcements."
            )
            return
        }

        if (!title || !message) {
            setAnnouncementSubmitError(
                "Enter a title and announcement message."
            )
            return
        }

        if (!currentLeagueName || !currentProfile?.id) {
            setAnnouncementSubmitError(
                "The league or signed-in profile could not be identified."
            )
            return
        }

        setAnnouncementSubmitting(true)
        setAnnouncementSubmitError("")

        const { data: createdAnnouncement, error: announcementError, } = await supabase
            .from("announcements")
            .insert({
                league_name: currentLeagueName,
                team_id: null,
                title,
                summary: summary || null,
                message,
                created_by: currentProfile.id,
            })
            .select("id")
            .single()
        
        if (announcementError) {
            console.error(
                "Unable to create league announcements:",
                announcementError
            )

            setAnnouncementSubmitError(
                "Unable to create the announcement."
            )
            setAnnouncementSubmitting(false)
            return
        }

        await createLeagueFeedEvent({
            eventType: "announcement",
            title: "New league announcement",
            message: `${currentProfile.full_name ?? "An admin"} posted “${title}.”`,
            relatedEntityType: "announcement",
            relatedEntityId: createdAnnouncement.id,
        });

        setAnnouncementDraft({
            title: "",
            summary: "",
            message: "",
        });

        setAnnouncementFormOpen(false);
        setAnnouncementSubmitting(false);

        await loadLeagueAlerts(currentLeagueName);
    
    }

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
                    sponsor_image_url,
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

            const varsityInn = data?.find(
                (team) => team.name === 'Varsity Inn'
            )

            setTeams(data ?? [])
        }

        loadTeams()
    }, [currentProfile])

    const currentLeagueName = teams[0]?.league_name ?? null;

    useEffect(() => {
        if (!currentLeagueName) {
            setLeagueAlerts([]);
            setFeedItems([]);
            return;
        }
        
        loadLeagueAlerts(currentLeagueName);
        loadLeagueFeed(currentLeagueName);
    }, [currentLeagueName]);

    const upcomingGame = upcomingGames[nextGameIndex];
    const rawMyTeam = teams.find((t) => t.name === "Red Bricks") ?? teams[0];

    const myTeam = rawMyTeam
      ? {
            ...rawMyTeam,
            roster: rawMyTeam.team_members ?? [],
        }
      : null;

        useEffect(() => {
        if (!currentProfile) {
            return
        }

        async function loadUpcomingGames() {

            if (!myTeam?.id) {
                setUpcomingGames([]);
                return;
            }
 
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
                .order('starts_at', { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setUpcomingGames(data ?? []);
        }

        loadUpcomingGames();
    }, [currentProfile, myTeam?.id]);


    const currentUserId = currentProfile?.id ?? null;


    // What did THIS USER answer?
    useEffect(() => {
        if (!upcomingGame?.id || !currentProfile?.id) {
            setUserRsvp("pending");
            return;
        }
        
        async function loadCurrentRsvp() {
            const { data, error } = await supabase
                .from("game_rsvps")
                .select("status")
                .eq("game_id", upcomingGame.id)
                .eq("profile_id", currentProfile.id)
                .maybeSingle();

                if (error) {
                    console.error("Unable to load RSVP:", error);
                    return;
                }

                setUserRsvp(data?.status ?? "pending");
            }

            loadCurrentRsvp();
    }, [upcomingGame?.id, currentProfile?.id]);


    // WHat did EVERYONE answer?
    useEffect(() => {
        if(!upcomingGame?.id) {
            setTeamAttendance({
                going: 0,
                maybe: 0,
                out: 0,
                noResponse: 0,
            });
            return;
        }

        async function loadTeamAttendance() {
            const { data, attendanceError } = await supabase
                .from("game_rsvps")
                .select("status")
                .eq("game_id", upcomingGame.id);
            
            if (attendanceError) {
                console.error("Unable to load team attendance:", attendanceError);
                return;
            }

            const attendance = {
                going: 0,
                maybe: 0,
                out: 0,
                noResponse: 0,
            };

            for (const rsvp of data ?? []) {
                if (rsvp.status == "going") {
                    attendance.going += 1;
                } else if (rsvp.status == "maybe") {
                    attendance.maybe += 1;
                } else if (rsvp.status == "out") {
                    attendance.out += 1;
                }
            }

            setTeamAttendance(attendance);
        
        }

        loadTeamAttendance();
    }, [upcomingGame?.id]);

    const gameContext = buildNextGameContext({
        game: upcomingGame,
        myTeam,
        teams,
        attendance: {
            ...teamAttendance,
            noResponse: countNoResponse(
                myTeam?.roster ?? [],
                userRsvp,
                currentUserId
            ),
        },
        subRequested,
        userRsvp,
        currentUserId,
    });


    async function handleRsvp(status) {
        if (
            !upcomingGame?.id ||
            !currentProfile?.id ||
            status === userRsvp
        ) {
            return;
        }

        const previousStatus = userRsvp;

        const { error: rsvpError } = await supabase
            .from("game_rsvps")
            .upsert(
                {
                    game_id: upcomingGame.id,
                    profile_id: currentProfile.id,
                    status,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "game_id,profile_id",
                }
            );

        if (rsvpError) {
            console.error("Unable to save RSVP:", rsvpError);
            return;
        }

        setUserRsvp(status);

        setTeamAttendance((current) => {
            const next = { ...current };

            if (
                previousStatus && 
                previousStatus !== "pending"
            ) {
                next[previousStatus] = Math.max(
                    0, 
                    (next[previousStatus] ?? 0) - 1
                );
            }
        
            next[status] = (next[status] ?? 0) + 1;

            return next;
        });

        await createLeagueFeedEvent({
            eventType: "attendance_update",
            title: "Attendance updated",
            message: `${
                currentProfile.full_name ?? "A player"
            } marked ${rsvpLabel(status)} for ${
                gameContext?.matchup ?? "the next game"
            }.`,
            teamId: currentTeamId,
            relatedEntityType: "game",
            relatedEntityId: upcomingGame.id,
        });
    }
    
    useEffect(() => {
        if (!currentProfile?.id || upcomingGames.length === 0) {
            setMobileRsvpsByGame({});
            setMobileAttendanceByGame({});
            return;
        }

        async function loadMobileGameData() {
            const gameIds = upcomingGames.map((game) => game.id);

            const { data, error } = await supabase
                .from("game_rsvps")
                .select("game_id, profile_id, status")
                .in("game_id", gameIds);
            
            if (error) {
                console.error("Unable to load mobile game RSVPS:", error)
                return;
            }

            const nextRsvpsByGame = {};
            const nextAttendanceByGame = {};
            
            // Create an empty bucket for every game first
            for (const game of upcomingGames) {
                nextRsvpsByGame[game.id] = "pending";

                nextAttendanceByGame[game.id] = {
                    going: 0,
                    maybe: 0,
                    out: 0,
                    noResponse: 0,
                };
            }

            // Now fill those buckets from Supabase
            for (const rsvp of data ?? []) {
                const attendance = nextAttendanceByGame[rsvp.game_id];

                if (!attendance) {
                    continue;
                }

                if (rsvp.status == "going") {
                    attendance.going += 1;
                } else if (rsvp.status == "maybe") {
                    attendance.maybe += 1;
                } else if (rsvp.status == "out") {
                    attendance.out += 1;
                }

                if (rsvp.profile_id === currentProfile.id) {
                    nextRsvpsByGame[rsvp.game_id] =
                        rsvp.status ?? "pending";
                }
            }

            setMobileRsvpsByGame(nextRsvpsByGame);
            setMobileAttendanceByGame(nextAttendanceByGame);
        }

        loadMobileGameData();
    }, [upcomingGames, currentProfile?.id]);

    const mobileGameContexts = upcomingGames
        .map((game) => {
            const attendance = 
                mobileAttendanceByGame[game.id] ?? {
                    going: 0,
                    maybe: 0,
                    out: 0,
                    noResponse: 0,
                };

            const userRsvpForGame = mobileRsvpsByGame[game.id] ?? "pending"

            const context = buildNextGameContext({
                game,
                myTeam,
                teams,
                attendance,
                subRequested,
                userRsvp: userRsvpForGame,
                currentUserId
            });

            return {
                game,
                context,
                userRsvp: userRsvpForGame,
                attendance,
            };
        })
        .filter((item) => item.context);
    
    async function onMobileRsvp(game, status) {
        if (!currentProfile?.id || !game?.id) {
            return;
        }

        const previousStatus = mobileRsvpsByGame[game.id] ?? "pending";

        const { error } = await supabase
        .from("game_rsvps")
        .upsert(
            {
                game_id: game.id,
                profile_id: currentProfile.id,
                status,
            },
            {
                onConflict: "game_id,profile_id",
            }
        );

        if (error) {
            console.error(
                "Unable to save mobile RSVP:",
                error
            );
            return;
        }

        setMobileRsvpsByGame((current) => ({
            ...current,
            [game.id]: status,
        }));

        // Keep the desktop Next Game RSVP in sync with schedule changes
        if (game.id === upcomingGame?.id) {
            setUserRsvp(status);
        }

        setMobileAttendanceByGame((current) => {
            const currentAttendance =
                current[game.id] ?? {
                    going: 0,
                    maybe: 0,
                    out: 0,
                    noResponse: 0,
                };
            
            const nextAttendance = {
                ...currentAttendance,
            };

            if (
                previousStatus &&
                previousStatus !== "pending"
            ) {
                nextAttendance[previousStatus] = Math.max(
                    0,
                    (nextAttendance[previousStatus] ?? 0) - 1
                );
            }

            nextAttendance[status] = (nextAttendance[status] ?? 0) + 1;

            return {
                ...current,
                [game.id]: nextAttendance,
            };
        });
    }
    
    const navigateTo = (view) => {
        setActiveView(view)
        setEditingPlayer(false)
        setIsMobileNavOpen(false)

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

    // League feed functions

    async function loadLeagueFeed(leagueName) {
        if (!leagueName) {
            setFeedItems([])
            return
        }

        setFeedLoading(true)
        setFeedError("")

        const { data, error } = await supabase
            .from("league_feed_events")
            .select(`
                id,
                event_type,
                title,
                message,
                related_entity_type,
                related_entity_id,
                created_at
            `)
            .eq("league_name", leagueName)
            .order("created_at", { ascending: false })
            .limit(50)
        
            if (error) {
                console.error("Unable to load league feed", error)
                setFeedItems([])
                setFeedError("Unable to load league activity.")
                setFeedLoading(false)
                return
            }

            const formattedFeedItems = (data ?? []).map((event) =>  ({
                    id: event.id,
                    type: event.event_type,
                    title: event.title,
                    message: event.message,
                    date: new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                    }).format(new Date(event.created_at)),
                    relatedEntityType: event.related_entity_type,
                    relatedEntityId: event.related_entity_id,
                }));
            
            setFeedItems(formattedFeedItems)
            setFeedLoading(false)
        }
    
    async function createLeagueFeedEvent({
        eventType,
        title,
        message,
        teamId = null,
        relatedEntityType = null,
        relatedEntityId = null
    }) {
        if(!currentLeagueName || !currentProfile?.id) {
            return {
                error: new Error(
                    "League or signed-in profile is unavailable."
                ),
            };
        }
        
        const { error: feedEventError } = await supabase
            .from("league_feed_events")
            .insert({
                league_name: currentLeagueName,
                team_id: teamId,
                actor_profile_id: currentProfile.id,
                event_type: eventType,
                title,
                message,
                related_entity_type: relatedEntityType,
                related_entity_id: relatedEntityId,
            });
        
        if (feedEventError) {
            console.error(
                "Unable to create league feed event:", 
                feedEventError
            );

            return {
                error: feedEventError,
            };
        }

        await loadLeagueFeed(currentLeagueName);

        return { 
            error: null, 
        };
    }

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

            const currentLeagueName = teams[0]?.league_name ?? "";

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
                    teams={teams}
                    currentUserId={currentUserId}
                    userRsvp={userRsvp}
                    onBack={() => {
                        setSelectedTeam(null)
                        setSelectedPlayer(null)
                        setEditingPlayer(false)
                    }}
                    onSelectPlayer={openPlayer}
                    onSponsorImageUpdated={(teamId, newUrl) => {
                        setTeams((currentTeams) =>
                            currentTeams.map((currentTeam) =>
                                currentTeam.id === teamId
                                    ? {
                                        ...currentTeam,
                                        sponsor_image_url: newUrl
                                      }
                                    : currentTeam
                            )
                        )

                        setSelectedTeam((currentTeam) =>
                            currentTeam?.id === teamId
                                ?   {
                                    ...currentTeam,
                                    sponsor_image_url: newUrl
                                    }
                                : currentTeam
                        )

                    }}
                />
            )
        }

        switch (activeView) {
            case "dashboard":
                return (
                    <DashboardView
                        currentUserId={currentUserId}
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
                        mobileGameContexts={mobileGameContexts}
                        onMobileRsvp={onMobileRsvp}
                    />
                )

            case "schedule":
                return (
                    <ScheduleView
                        teams={teams}
                        myTeam={myTeam}
                        currentUserId={currentUserId}
                        currentTeamId={currentTeamId}
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
                        mobileGameContexts={mobileGameContexts}
                        onMobileRsvp={onMobileRsvp}
                        mobileRsvpsByGame={mobileRsvpsByGame}
                        mobileAttendanceByGame={mobileAttendanceByGame}
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
                        alerts={leagueAlerts}
                        alertsLoading={leagueAlertsLoading}
                        alertsError={leagueAlertsError}
                        feedItems={feedItems}
                        expandedNoticeId={expandedNoticeId}
                        onToggleNotice={setExpandedNoticeId}
                        expandedFeedId={expandedFeedId}
                        onToggleFeed={setExpandedFeedId}
                        onViewGame={() => navigateTo("schedule")}
                        
                        canCreateAnnouncement={currentProfile?.is_admin === true}
                        announcementFormOpen={announcementFormOpen}
                        announcementDraft={announcementDraft}
                        announcementSubmitting={announcementSubmitting}
                        announcementSubmitError={announcementSubmitError}

                        onOpenAnnouncementForm={() => {
                            setAnnouncementSubmitError("")
                            setAnnouncementFormOpen(true)
                        }}

                        onCloseAnnouncementForm={() => {
                            setAnnouncementSubmitError("")
                            setAnnouncementFormOpen(false)
                        }}

                        onAnnouncementDraftChange={setAnnouncementDraft}
                        onCreateAnnouncement={handleCreateAnnouncement}
                    />
                );

            case "chat":
                return (
                    <ChatView
                        chats={chats}
                        activeChatId={activeChatId}
                        onSelectChat={setActiveChatId}
                        messages={
                            activeChatId
                                ? chatMessages[activeChatId] ?? []
                                : []
                        }
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

    if (isSetPasswordPage) {
        return <SetPassword />
    }   


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
                    <button
                        type="button"
                        className="mobile-nav-button"
                        aria-label="Open navigation"
                        aria-expanded={isMobileNavOpen}
                        aria-controls="league-navigation"
                        onClick={() => setIsMobileNavOpen(true)}
                    >
                        <HockeyIcon size={22} />
                    </button>

                    <HockeyIcon 
                        size={22} 
                        className="app-bar-icon desktop-brand-icon" 
                    />

                    <div>
                        <h1 className="app-bar-title">Hockey League</h1>
                        <span className="app-bar-subtitle">
                            {currentLeagueName
                                ? `${currentLeagueName} · Season 2026`
                                : "Season 2026"}
                        </span>
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
                                setNextGameIndex((index) =>
                                    index === 0 ? 0 : index - 1
                                );
                            }}
                            disabled={upcomingGames.length <= 1 || nextGameIndex === 0}
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
                <nav
                    id="league-navigation"
                    className={`sidebar${isMobileNavOpen ? " is-open" : ""}`}
                    aria-label="League navigation"
                >
                    <div className="mobile-drawer-header">
                        <span>Menu</span>

                        <button
                            type="button"
                            className="mobile-nav-close"
                            aria-label="Close navigation"
                            onClick={() => setIsMobileNavOpen(false)}
                        >
                            x
                        </button>
                    </div>

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

                {isMobileNavOpen && (
                    <button
                        type="button"
                        className="mobile-nav-backdrop"
                        aria-label="Close navigation"
                        onClick={() => setIsMobileNavOpen(false)}
                    />
                )}

                <main className="main-content">{mainContent}</main>

                {!selectedPlayer && (
                    <TonightsRoster
                    game={upcomingGame}
                    teams={teams}
                    userRsvp={userRsvp}
                    currentUserId={currentUserId}
                    onPromptPlayers={promptNoResponse}
                />
                )}
            </div>
        </div>
    );
}

function DashboardView({
    currentUserId,
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
    mobileGameContexts,
    onMobileRsvp,
}) {
    const subStatus = formatSubStatus(myTeam?.substituteStatus, subRequested);
    const noResponse = countNoResponse(
        myTeam?.roster ?? [],
        userRsvp,
        currentUserId
    );
    const attendanceDetail = gameContext ? formatAttendanceDetail(gameContext) : "";

    const [gameActionsOpen, setGameActionsOpen] = useState(false);

    return (
        <div className="page-view dashboard-view">
            <header className="page-header">
                <h2>Dashboard</h2>
            </header>

            <div className="dashboard-grid">
                <div className="desktop-next-game">
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
                                <div className="action-stack action-stack--mobile">
                                    <button type="button" className="action-btn action-btn--primary" onClick={onMessageTeam}>Message Team</button>
                                    <div className="game-more-actions">
                                        <button 
                                            type="button" 
                                            className="game-more-button" 
                                            onClick={() => setGameActionsOpen((open) =>  !open)}
                                            aria-label="More game actions"
                                            aria-expanded={gameActionsOpen}
                                        >
                                             ⋮
                                        </button>

                                        {gameActionsOpen && (
                                            <div className="game-actions-menu">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setGameActionsOpen(false);
                                                        onRequestSub();
                                                    }}
                                                >
                                                    Request Sub
                                                </button>

                                                {noResponse > 0 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setGameActionsOpen(false);
                                                            onPromptNoResponse();
                                                        }}
                                                    >
                                                        Prompt No Response
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>    
                    </section>
                ) : (
                    <section className="content-card"><p className="empty-state">No upcoming games.</p></section>
                )}
                </div>

                <div className="mobile-next-games">
                    {mobileGameContexts.length > 0 ? (
                        <div className="mobile-game-carousel">
                            {mobileGameContexts.map(
                                ({ game, context, userRsvp: mobileUserRsvp }) => (
                                    <section
                                        key={game.id}
                                        className="content-card next-game-card content-card--hero mobile-game-slide"
                                    >
                                    <header className="content-card-header">
                                        <h2>Next Game</h2>
                                    </header>

                                    <div className="next-game-columns">
                                        <div className="next-game-col next-game-col--info">
                                            <div className="next-game-matchup">
                                                {context.matchup}
                                            </div>

                                            <p className="next-game-when">
                                                {context.date} · {context.time} · {context.rink}
                                            </p>
                                        </div>

                                        <div className="next-game-col next-game-col--attendance">
                                            <span className="attendance-hero-number">
                                                {context.skatersGoing} skaters
                                            </span>

                                            <p className="attendance-status-line">
                                                {context.goalieStatus}
                                            </p>
                                        </div>

                                        <div className="next-game-col next-game-col--actions">
                                            <span className="col-label">
                                                Your Status
                                            </span>

                                            <p className="your-status">
                                                Currently{" "}
                                                <strong className={`text-${mobileUserRsvp}`}>
                                                    {rsvpLabel(mobileUserRsvp)}
                                                </strong>
                                            </p>

                                            <RsvpControls
                                                value={mobileUserRsvp}
                                                onChange={(status) =>
                                                    onMobileRsvp(game, status)
                                                }
                                                size="large"
                                            />

                                            <div className="action-stack action-stack--mobile">
                                                <button
                                                    type="button"
                                                    className="action-btn action-btn--primary"
                                                    onClick={onMessageTeam}
                                                >
                                                    Message Team
                                                </button>

                                                <div className="game-more-actions">
                                                    <button
                                                        type="button"
                                                        className="game-more-button"
                                                        onClick={() =>
                                                            setGameActionsOpen(
                                                                (open) => !open
                                                            )
                                                        }
                                                        aria-label="More game actions"
                                                        aria-expanded={gameActionsOpen}
                                                    >
                                                        ⋮
                                                    </button>

                                                    {gameActionsOpen && (
                                                        <div className="game-actions-menu">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setGameActionsOpen(false);
                                                                    onRequestSub();
                                                                }}
                                                            >
                                                                Request Sub
                                                            </button>

                                                            {context.noResponse > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setGameActionsOpen(false);
                                                                        onPromptNoResponse();
                                                                    }}
                                                                >
                                                                    Prompt No Response
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )
                        )}
                    </div>
                ) : (
                    <section className="content-card">
                        <p className="empty-state">
                            No upcoming games.
                        </p>
                    </section>
                )}
            </div>

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

    const forwards = roster.filter((member) =>
        ["f", "forward"].includes(
            member.position?.trim().toLowerCase()
        )
    ).length;

    const defense = roster.filter((member) =>
        ["d", "defense"].includes(
            member.position?.trim().toLowerCase()
        )
    ).length;

    const goalies = roster.filter((member) =>
        ["g", "goalie", "goaltender"].includes(
            member.position?.trim().toLowerCase()
        )
    ).length;

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

function ScheduleView({ teams, myTeam, currentUserId, currentTeamId, userRsvp, onRsvp, gameContext, onMessageTeam, onRequestSub, mobileGameContexts = [], onMobileRsvp, mobileRsvpsByGame, mobileAttendanceByGame }) {
    const [games, setGames] = useState([])
    const [detailGame, setDetailGame] = useState(null);
    const [rsvpGameId, setRsvpGameId] = useState(null);
    const [calendarDate, setCalendarDate] = useState(new Date());

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function goToPreviousMonth() {
        setCalendarDate((current) =>
            new Date(
                current.getFullYear(),
                current.getMonth() - 1,
                1
            )
        );
    }

    function goToNextMonth() {
        setCalendarDate((current) =>
            new Date(
                current.getFullYear(),
                current.getMonth() + 1,
                1
            )
        );
    }

    function goToCurrentMonth() {
        setCalendarDate(new Date());
    }

    useEffect(() => {
        if (!myTeam?.id) {
            return;
        }

        async function loadGames() {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
                .order('starts_at', { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setGames(data);
        }

        loadGames();
    }, [myTeam?.id]);

    // Desktop version of Schedule - Calendar

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(
        firstDayOfMonth.getDate() - firstDayOfMonth.getDay()
    );

    const calendarEnd = new Date(lastDayOfMonth);
    calendarEnd.setDate(
        lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay())
    );

    const calendarDays = []

    const cursor = new Date(calendarStart);

    while (cursor <= calendarEnd) {
        calendarDays.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    // Mobile schedule: only show games in the currently selected calendar month
    const mobileMonthGames = games.filter((game) => {
        const gameDate = new Date(`${game.game_date}T00:00:00`);

        return (
            gameDate.getFullYear() === year && 
            gameDate.getMonth() === month
        );
    });



    return (
        <div className="page-view schedule-view">
            <header className="page-header">
                <h2>Schedule</h2>
                <p className="page-subtitle">{games.length} games · South Suburban Sports Complex</p>
            </header>
            <div className="desktop-schedule">
            <section className="content-card schedule-calendar">
                <div className="schedule-calendar-toolbar">
                    <h3>
                        {calendarDate.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                        })}
                    </h3>

                <div className="schedule-calendar-actions">
                    <button
                        type="button"
                        className="action-btn action-btn--secondary"
                        onClick={goToPreviousMonth}
                    >
                        ←
                    </button>

                    <button
                        type="button"
                        className="action-btn action-btn--secondary"
                        onClick={goToCurrentMonth}
                    >
                        Today
                    </button>

                    <button
                        type="button"
                        className="action-btn action-btn--secondary"
                        onClick={goToNextMonth}
                    >
                        →
                    </button>
                </div>
            </div>

            <div className="schedule-calendar-weekdays">
                {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                ].map((day) => (
                    <div key={day}>{day}</div>
                ))}
            </div>

            <div className="schedule-calendar-grid">
                {calendarDays.map((day) => {
                    const dateKey = formatDateKey(day);

                    const dayGames = games.filter(
                        (game) => game.game_date === dateKey
                    );

                    const isCurrentMonth = day.getMonth() === month;

                    const isToday = formatDateKey(day) === formatDateKey(new Date());

                    return (
                        <div
                            key={dateKey}
                            className={[
                                "schedule-calendar-day",
                                !isCurrentMonth
                                    ? "is-outside-month"
                                    : "",
                                isToday ? "is-today" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            <div className="schedule-calendar-date">
                                {day.getDate()}
                            </div>

                            <div className="schedule-calendar-games">
                                {dayGames.map((game) => {
                                    // Get the current user's RSVP for this game
                                    const gameRsvp =
                                        mobileRsvpsByGame[game.id] ?? "pending";

                                    // Get the current attendance counts for this game
                                    const attendance =
                                        mobileAttendanceByGame[game.id] ?? {
                                            going: 0,
                                            maybe: 0,
                                            out: 0,
                                            noResponse: 0,
                                        };


                                    const going = attendance.going;
                                    const maybe = attendance.maybe;
                                    const out = attendance.out;

                                    const showRsvp = rsvpGameId === game.id;

                                    return (
                                    <div
                                        key={game.id}
                                        className="schedule-calendar-game"
                                    >
                                        <button
                                            type="button"
                                            className="schedule-calendar-game-main"
                                            onClick={() =>
                                                setDetailGame(game)
                                            }
                                        >
                                            <span className="schedule-calendar-game-time">
                                                {formatGameTime(
                                                    game.start_time
                                                )}
                                            </span>

                                            <span className="schedule-calendar-game-teams">
                                                {
                                                    game.home_team_name
                                                }{" "}
                                                vs{" "}
                                                {
                                                    game.away_team_name
                                                }
                                            </span>

                                            <span className="schedule-calendar-game-rink">
                                                {
                                                    game.location_name
                                                }
                                                {game.rink
                                                    ? ` · ${game.rink}`
                                                    : ""}
                                            </span>

                                            <span
                                                className={`schedule-calendar-rsvp text-${gameRsvp}`}
                                            >
                                                {rsvpLabel(gameRsvp)}
                                            </span>
                                        </button>

                                        <div className="schedule-calendar-rsvp-wrap">
                                            <button
                                            type="button"
                                            className="schedule-calendar-rsvp-button"
                                            onClick={() =>
                                                setRsvpGameId(
                                                    showRsvp ? null : game.id
                                                )
                                            }
                                        >
                                            RSVP
                                            </button>

                                            {showRsvp && (
                                                <div className="schedule-calendar-rsvp-popover">
                                                    <span className="col-label">
                                                        Your RSVP
                                                    </span>

                                            <RsvpControls
                                                value={gameRsvp}
                                                onChange={(status) => {
                                                    onMobileRsvp(game, status);
                                                    setRsvpGameId(null);
                                                }}
                                            />

                                            <span className="schedule-calendar-attendance">
                                                {attendance.going}G ·{" "}
                                                {attendance.maybe}M ·{" "}
                                                {attendance.out}O
                                            </span>
                                        </div>
                                    )}
                                </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    </section>
    </div>
    
    {/* Mobile schedule: compact chronological agenda list */}
    <div className="mobile-schedule">
    <section className="content-card mobile-schedule-list">
        <div className="mobile-schedule-games">
            {games.length > 0 ? (
                games.map((game, index) => {
                    // Get the current user's RSVP for this game
                    const gameRsvp =
                        mobileRsvpsByGame[game.id] ?? "pending";

                    // Get the current attendance counts for this game
                    const attendance =
                        mobileAttendanceByGame[game.id] ?? {
                            going: 0,
                            maybe: 0,
                            out: 0,
                            noResponse: 0,
                        };
                
                    const showRsvp = rsvpGameId === game.id;

                    const gameDate = new Date(`${game.game_date}T00:00:00`);

                    // Compare this game to the previous  one so we know
                    // when to display a new month heading
                    const previousGame = index > 0 ? games[index - 1] : null;

                    const previousGameDate = previousGame
                        ? new Date(`${previousGame.game_date}T00:00:00`) : null;
                    const showMonthHeading = 
                        !previousGameDate || 
                        previousGameDate.getMonth() !== 
                            gameDate.getMonth() ||
                        previousGameDate.getFullYear() !==
                            gameDate.getFullYear();
                    
                    return (
                        <div key={game.id}>
                            {showMonthHeading && (
                                <h3 className="mobile-schedule-month">
                                    {gameDate.toLocaleDateString(
                                        "en-US",
                                        {
                                            month: "long",
                                            year: "numeric",
                                        }
                                    )}
                                </h3>
                            )}

                            <div className="mobile-schedule-game">
                                {/* Game date */}
                                <div className="mobile-schedule-date">
                                    <span className="mobile-schedule-date-number">
                                        {gameDate.getDate()}
                                    </span>

                                    <span className="mobile-schedule-date-day">
                                        {gameDate.toLocaleDateString(
                                            "en-US",
                                            {
                                                weekday: "short",
                                            }
                                        )}
                                    </span>
                                </div>

                                {/* Game information */}
                                <button
                                    type="button"
                                    className="mobile-schedule-game-main"
                                    onClick={() => setDetailGame(game)}
                                >
                                    <span className="mobile-schedule-game-time">
                                        {formatGameTime(game.start_time)}
                                    </span>

                                    <span className="mobile-schedule-game-matchup">
                                        {game.home_team_name} vs {" "}
                                        {game.away_team_name}
                                    </span>

                                    <span className="mobile-schedule-game-rink">
                                        {game.location_name}
                                        {game.rink ? ` · ${game.rink}` : ""}
                                    </span> 
                                </button>

                                {/* RSVP status */}
                                <div className="mobile-schedule-rsvp">
                                    <button
                                        type="button"
                                        className={`mobile-schedule-rsvp-status mobile-schedule-rsvp-status--${gameRsvp}`}
                                        onClick={() =>
                                            setRsvpGameId(
                                                showRsvp
                                                    ? null
                                                    : game.id
                                            )
                                         }
                                         aria-label={`RSVP: ${rsvpLabel(gameRsvp)}`}
                                    >
                                        {gameRsvp === "going" && "✓"}
                                        {gameRsvp === "maybe" && "?"}
                                        {gameRsvp === "out" && "×"}
                                        {gameRsvp === "pending" && "?"}
                                    </button>

                                    {showRsvp && (
                                        <div className="mobile-schedule-rsvp-popover">
                                            <span className="col-label">
                                                Your RSVP
                                            </span>

                                            <RsvpControls
                                                value={gameRsvp}
                                                onChange={(status) => {
                                                    onMobileRsvp(
                                                        game,
                                                        status
                                                    );
                                                    setRsvpGameId(
                                                        null
                                                    );
                                                }}
                                            />

                                            <span className="schedule-calendar-attendance">
                                                {attendance.going}G ·{" "}
                                                {attendance.maybe}M ·{" "}
                                                {attendance.out}O
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <p className="empty-state">
                    No upcoming games.
                </p>
            )}
        </div>
    </section>
    </div>

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

function TeamDetail({ team, teams, games, currentUserId, league, userRsvp, onBack, onSelectPlayer, onSponsorImageUpdated }) {

    const [sponsorFile, setSponsorFile] = useState(null)
    const [sponsorPreviewUrl, setSponsorPreviewUrl] = useState(
        team?.sponsor_image_url ?? ''
    )   

    const [isEditingSponsor, setIsEditingSponsor] = useState(false)
    const [sponsorImageUrl, setSponsorImageUrl] = useState(
        team?.sponsor_image_url ?? ''
    )
    const [isSavingSponsor, setIsSavingSponsor] = useState(false)
    const [sponsorError, setSponsorError] = useState('')

    const roster = Array.isArray(team?.team_members)
    ? [...team.team_members].sort((a, b) => {
        const aName = a.profiles?.full_name ?? '';
        const bName = b.profiles?.full_name ?? '';

        return aName.localeCompare(bName);
       })
    :  []


    useEffect(() => {
        setSponsorImageUrl(team?.sponsor_image_url ?? '')
        setSponsorPreviewUrl(team?.sponsor_image_url ?? '')
        setSponsorFile(null)
        setIsEditingSponsor(false)
        setSponsorError('') 
    }, [team?.id, team?.sponsor_image_url])

    async function saveSponsorImage() {
        setIsSavingSponsor(true)
        setSponsorError('')

        let savedUrl = team.sponsor_image_url ?? null

        if (sponsorFile) {
            const extension =
                sponsorFile.name.split('.').pop()?.toLowerCase() || 'png'

            const filePath =
                `${team.id}/sponsor-${Date.now()}.${extension}`

            const { error: uploadError } = await supabase.storage
                .from('team-assets')
                .upload(filePath, sponsorFile, {
                    cacheControl: '3600',
                    upsert: true
                })
            
            if (uploadError) {
                console.error(
                    'Error uploading sponsor image:',
                    uploadError
                )
                setSponsorError('Unable to upload the sponsor image.')
                setIsSavingSponsor(false)
                return
            }

            const { data: publicUrlData } = supabase.storage
                .from('team-assets')
                .getPublicUrl(filePath)

            savedUrl = publicUrlData.publicUrl
        }

        const { error: updateError } = await supabase
            .from('teams')
            .update({
                sponsor_image_url: savedUrl
            })
            .eq('id', team.id)
        
        if (updateError) {
            console.error(
                "Error updating sponsor image:", 
                updateError
            )
            setSponsorError("Unable to update the sponsor image.")
            setIsSavingSponsor(false)
            return
        }

        onSponsorImageUpdated?.(team.id, savedUrl)

        setSponsorFile(null)
        setSponsorPreviewUrl(savedUrl ?? '')
        setIsEditingSponsor(false)
        setIsSavingSponsor(false)
    }


    return (
        <div className="page-view team-detail-view">
            <button type="button" className="back-button" onClick={onBack}>← Back to teams</button>

            <header className="page-header">
                <h2>{team.name}</h2>
                <p className="page-subtitle">{roster.length} players</p>
            </header>

            <div className="team-sponsor-section">
                {team.sponsor_image_url && !isEditingSponsor && (
                    <div className="team-sponsor-banner">
                        <img
                            src={team.sponsor_image_url}
                            alt={`${team.name} sponsors`}
                        />
                    </div>
                )}

            {!isEditingSponsor ? (
                <button
                    type="button"
                    className="sponsor-edit-button"
                    onClick={() => setIsEditingSponsor(true)}
                >
                    {team.sponsor_image_url
                        ? 'Edit sponsor image'
                        : 'Add sponsor image'}
                </button>
            ) : (
                <div className="sponsor-image-editor">
                    <label className="form-field">
                        <span>Sponsor image</span>
                        <p className="field-help">For best results, upload a wide banner image. Recommended size: 1200 × 300 pixels.</p>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                                const file = event.target.files?.[0]

                                if (!file) {
                                    return
                                }

                                if (file.size > 5 * 1024 * 1024) {
                                    setSponsorError(
                                        "Choose an image smaller than 5 MB."
                                    )
                                    return
                                }
                                setSponsorFile(file)
                                setSponsorPreviewUrl(URL.createObjectURL(file))
                                setSponsorError('')
                            }}
                        />
                    </label>

                    {sponsorPreviewUrl && (
                        <div className="sponsor-image-preview">
                            <p>Preview</p>

                            <img
                                src={sponsorPreviewUrl}
                                alt="Sponsor banner preview"
                                onError={() => {
                                    setSponsorError(
                                        "The selected image could not be previewed."
                                    )
                                }}
                                onLoad={() => setSponsorError('')}
                            />
                        </div>
                    )}

                    {sponsorError && (
                        <p className="form-error">{sponsorError}</p>
                    )}

                    <div className="sponsor-form-actions">
                        <button
                            type="button"
                            className="button button-primary"
                            disabled={isSavingSponsor || Boolean(sponsorError)}
                            onClick={saveSponsorImage}
                        >

                            {isSavingSponsor ? 'Saving...' : 'Save'}
                        </button>

                        <button
                            type="button"
                            className="button button-secondary"
                            disabled={isSavingSponsor}
                            onClick={() => {
                                setSponsorFile(null)
                                setSponsorPreviewUrl(
                                    team.sponsor_image_url ?? ''
                                )
                                setSponsorError('')
                                setIsEditingSponsor(false)
                            }}
                        >
                            Cancel
                        </button>

                        {team.sponsor_image_url && (
                            <button
                                type="button"
                                className="button button-danger"
                                disabled={isSavingSponsor}
                                onClick={async () => {
                                    setIsSavingSponsor(true)
                                    setSponsorError('')

                                    const { error: removeError } = await supabase
                                        .from('teams')
                                        .update({
                                            sponsor_image_url: null
                                        })
                                        .eq('id', team.id)
                                    
                                    if (removeError) {
                                        console.error(
                                            "Unable to remove the sponsor image."
                                        )
                                        setIsSavingSponsor(false)
                                        return
                                    }

                                    onSponsorImageUpdated?.(team.id, null)
                                    setSponsorPreviewUrl('')
                                    setIsEditingSponsor(false)
                                    setIsSavingSponsor(false)
                                }}
                            >
                                Remove image
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div> 


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
                                <td>
                                    {{
                                        forward: "Forward",
                                        defense: "Defense",
                                        goalie: "Goalie",
                                        F: "Forward",
                                        D: "Defense",
                                        G: "Goalie",
                                    }[member.position] ?? member.position}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function PlayerDetail({ player, userRsvp, onBack }) {
    const status = resolveRsvp(player, userRsvp, currentUserId);
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

function NoticesView({
    alerts,
    alertsLoading,
    alertsError,
    feedItems,
    expandedNoticeId,
    onToggleNotice,
    expandedFeedId,
    onToggleFeed,
    onViewGame,

    isAdmin,
    canCreateAnnouncement,
    announcementFormOpen,
    announcementDraft,
    announcementSubmitting,
    announcementSubmitError,
    onOpenAnnouncementForm,
    onCloseAnnouncementForm,
    onAnnouncementDraftChange,
    onCreateAnnouncement,

    }) {

    return (
        <div className="page-view notices-view">
            <header className="page-header notices-page-header">
                <div>
                    <h2>League Notices</h2>
                    <p className="page-subtitle">
                        Official announcements and schedule changes
                    </p>
                </div>
            </header>
            {canCreateAnnouncement && announcementFormOpen && (
                <section className="content-card announcement-form-card">
                    <header className="content-card-header">
                        <div>
                            <h2>New Announcement</h2>
                            <p className="page-subtitle">
                                Publish a message to everyone in the league.
                            </p>
                        </div>
                    </header>

                    <form
                        className="announcement-form"
                        onSubmit={onCreateAnnouncement}
                    >
                        <label className="form-field">
                            <span>Title</span>
                            <input
                                type="text"
                                value={announcementDraft.title}
                                maxLength={120}
                                required
                                onChange={(event) =>
                                onAnnouncementDraftChange({
                                ...announcementDraft,
                                title: event.target.value,
                            })
                        }
                    />
                </label>

                <label className="form-field">
                    <span>Summary</span>
                    <input
                        type="text"
                        value={announcementDraft.summary}
                        maxLength={180}
                        placeholder="Optional short description"
                        onChange={(event) =>
                            onAnnouncementDraftChange({
                                ...announcementDraft,
                                summary: event.target.value,
                            })
                        }
                    />
                </label>

                <label className="form-field">
                    <span>Message</span>
                    <textarea
                        value={announcementDraft.message}
                        rows={5}
                        required
                        onChange={(event) =>
                            onAnnouncementDraftChange({
                                ...announcementDraft,
                                message: event.target.value,
                            })
                        }
                    />
                </label>

                {announcementSubmitError && (
                    <p className="form-error">
                        {announcementSubmitError}
                    </p>
                )}

                <div className="form-actions">
                    <button
                        type="button"
                        className="action-btn action-btn--outline"
                        onClick={onCloseAnnouncementForm}
                        disabled={announcementSubmitting}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="action-btn action-btn--primary"
                        disabled={announcementSubmitting}
                    >
                        {announcementSubmitting
                            ? "Publishing..."
                            : "Publish announcement"}
                    </button>
                </div>
            </form>
        </section>
    )}          

            <div>
                    {canCreateAnnouncement && (
                <button
                    type="button"
                    className="action-btn action-btn--primary"
                    onClick={onOpenAnnouncementForm}
                >
                    Create announcement
                </button>
                )}
            </div>
            <section className="content-card">
                <header className="content-card-header">
                        <h2>Announcements</h2>
                        <span className="content-card-meta">
                            {alerts.length} {alerts.length === 1 ? "notice" : "notices"}
                        </span>
                </header>
                {alertsLoading ? (
                    <p className="empty-state">Loading announcements...</p>
                ) : alertsError ? (
                    <p className="empty-state">{alertsError}</p>
                ) : alerts.length === 0 ? (
                    <p className="empty-state">No league announcements.</p>
                ) : (
                    alerts.map((alert) => {
                        const expanded = expandedNoticeId === alert.id;
                        return (
                            <div key={alert.id} className="notice-expandable">
                                <button type="button" className="notice-toggle" onClick={() => onToggleNotice(expanded ? null : alert.id)}>
                                    <time className="notice-date">{alert.date}</time>
                                    <strong className="notice-title">{alert.title}</strong>
                                    <span className="notice-summary">{alert.summary ?? alert.message}</span>
                                    {expanded ? (
                                        <IconChevronDown size={16} />
                                    ) : (
                                        <IconChevronRight size={16} />
                                    )}
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
                    })
                )}
            </section>
            <LeagueFeed
                items={feedItems}
                expandedId={expandedFeedId}
                onToggle={onToggleFeed}
            />
        </div>
    );
}

function ChatView({
    chats = [],
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

    const chat =
        chats.find((item) => item.id === activeChatId) ??
        chats[0] ??
        null

    if (!chat) {
        return (
            <div className="page-view chat-view">
                <header className="page-header">
                    <h2>Chat</h2>
                    <p className="page-subtitle">
                        Team and league conversations
                    </p>
                </header>

                <section className="content-card">
                    <p className="empty-state">
                        No chat channels are available yet.
                    </p>
                </section>
            </div>
        )
    }

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
                    {chats.length === 0 ? (
                        <p className="empty-state">No chat channels yet.</p>
                    ) : (
                        chats.map((ch) => (
                            <button
                                key={ch.id}
                                type="button"
                                className={`chat-channel${ch.id === activeChatId ? " is-active" : ""}`}
                                onClick={() => onSelectChat(ch.id)}
                            >
                                #{ch.name}
                            </button>
                        ))
                    )}
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
