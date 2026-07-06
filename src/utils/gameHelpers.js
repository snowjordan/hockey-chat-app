export const FEED_TYPE_LABELS = {
    schedule_change: "Schedule",
    attendance_update: "Attendance",
    chat_activity: "Chat",
    roster_update: "Roster",
    goalie_request: "Goalie",
    substitute_request: "Substitute",
};

export function getTeamName(teams, teamId) {
    return teams.find((t) => t.id === teamId)?.name ?? "TBD";
}

export function getTeamNextGame(team, games) {
    return games.find((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
}

export function getOpponentName(team, game, teams) {
    if (!game) return "TBD";
    const opponentId = game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
    return getTeamName(teams, opponentId);
}

export function formatNextGameShort(team, games, teams) {
    const game = getTeamNextGame(team, games);
    if (!game) return "No game scheduled";
    return `vs ${getOpponentName(team, game, teams)} · ${game.date}`;
}

export function getTeamRosterForGame(teamId, teams) {
    const team = teams.find((t) => t.id === teamId);
    return team ? team.roster.map((p) => ({ ...p, teamId })) : [];
}

export function getGameRoster(game, teams) {
    if (!game) return [];
    return [
        ...getTeamRosterForGame(game.homeTeamId, teams),
        ...getTeamRosterForGame(game.awayTeamId, teams),
    ];
}

export function resolveRsvp(player, userRsvp, currentUserId) {
    if (player.id === currentUserId) return userRsvp;
    return player.rsvp ?? "pending";
}

export function groupRosterByRsvp(players, userRsvp, currentUserId) {
    const groups = { going: [], maybe: [], out: [], pending: [] };
    for (const player of players) {
        const status = resolveRsvp(player, userRsvp, currentUserId);
        if (status === "going") groups.going.push(player);
        else if (status === "maybe") groups.maybe.push(player);
        else if (status === "out") groups.out.push(player);
        else groups.pending.push(player);
    }
    return groups;
}

export function countFieldSkaters(roster = []) {
    return roster.filter((p) => !p.isGoalie).length;
}

export function countNoResponse(roster, userRsvp, currentUserId) {
    return groupRosterByRsvp(roster, userRsvp, currentUserId).pending.length;
}

export function rsvpLabel(rsvp) {
    if (!rsvp || rsvp === "pending") return "No response";
    return rsvp.charAt(0).toUpperCase() + rsvp.slice(1);
}

export function formatSubStatus(status, subRequested) {
    if (subRequested) return "Need 1 sub";
    if (!status || status === "None" || status === "No subs needed") return "No subs needed";
    return status;
}

export function isGoalieNeeded(status) {
    if (!status) return true;
    const lower = status.toLowerCase();
    return lower.includes("needed") || lower.includes("not set") || lower.includes("1 of");
}

export function isSubNeeded(status, subRequested) {
    if (subRequested) return true;
    if (!status || status === "None" || status === "No subs needed") return false;
    return status.toLowerCase().includes("need") || status.toLowerCase().includes("looking");
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


export function buildNextGameContext({ game, myTeam, teams, attendance, subRequested, userRsvp, currentUserId }) {
    if (!game || !myTeam) return null;

    const isHome = game.home_team_id === myTeam.id;
    const opponent = isHome ? game.away_team_name : game.home_team_name;
    const matchup = `${game.home_team_name} vs ${game.away_team_name}`;
    const rink = `${game.location_name ?? ""}${game.rink ? ` · ${game.rink}` : ""}`;
    const going = attendance?.going ?? 0;
    const maybe = attendance?.maybe ?? 0;
    const out = attendance?.out ?? 0;
    const noResponse =
        attendance?.noResponse ??
        countNoResponse(myTeam.roster, userRsvp, currentUserId);
    const goalieOk = !isGoalieNeeded(myTeam.goalieStatus);
    const subsNeeded = isSubNeeded(myTeam.substituteStatus, subRequested);

    return {
        matchup,
        opponent,
        date: formatGameDate(game.game_date),
        time: formatGameTime(game.start_time),
        rink,
        skatersGoing: going,
        maybe,
        out,
        noResponse,
        rosterTotal: countFieldSkaters(myTeam.roster ?? []),
        goalieStatus: myTeam.goalieStatus,
        goalieOk,
        subStatus: formatSubStatus(myTeam.substituteStatus, subRequested),
        subsNeeded,
    };
}

export function getRibbonSegments(ctx) {
    if (!ctx) return [];
    return [
        ctx.matchup,
        ctx.date,
        ctx.time,
        ctx.rink,
    ];
}

export function formatAttendanceDetail(ctx) {
    if (!ctx) return "";
    const parts = [];
    if (ctx.maybe > 0) parts.push(`${ctx.maybe} maybe`);
    if (ctx.out > 0) parts.push(`${ctx.out} out`);
    if (ctx.noResponse > 0) parts.push(`${ctx.noResponse} no response`);
    return parts.join(" · ");
}

export function getChatPrefill(type, ctx) {
    if (!ctx) return "";
    switch (type) {
        case "goalie":
            return `Looking for a goalie for ${ctx.date} at ${ctx.rink}. Anyone available?`;
        case "sub":
            return `We need 1 sub for ${ctx.date} at ${ctx.rink}. Let us know if you can play.`;
        case "game":
            return `Reminder: ${ctx.matchup} is ${ctx.date} at ${ctx.time} at ${ctx.rink}.`;
        case "prompt":
            return `Quick reminder to RSVP for ${ctx.date} at ${ctx.rink} when you get a chance.`;
        default:
            return "";
    }
}
