export const RSVP_STATUSES = Object.freeze([
    "going",
    "maybe",
    "out",
]);

export function findTeamForProfile(teams = [], profileId) {
    if (!profileId || !Array.isArray(teams)) {
        return null;
    }

    return (
        teams.find((team) =>
            (team.team_members ?? []).some(
                (member) =>
                    member.profile_id === profileId ||
                    member.profiles?.id === profileId
            )
        ) ?? null
    );
}

export function canRsvpToGame(game, teamId) {
    if (!game || !teamId) {
        return false;
    }

    return (
        game.home_team_id === teamId ||
        game.away_team_id === teamId
    );
}

export function filterGamesForTeam(games = [], teamId) {
    if (!Array.isArray(games) || !teamId) {
        return [];
    }

    return games.filter((game) =>
        canRsvpToGame(game, teamId)
    );
}

export function isValidRsvpStatus(status) {
    return RSVP_STATUSES.includes(status);
}

export function applyRsvpAttendanceChange(
    attendance = {},
    previousStatus,
    nextStatus
) {
    const next = { ...attendance };

    if (!isValidRsvpStatus(nextStatus)) {
        return next;
    }

    if (previousStatus === nextStatus) {
        return next;
    }

    if (isValidRsvpStatus(previousStatus)) {
        next[previousStatus] = Math.max(
            0,
            (next[previousStatus] ?? 0) - 1
        );
    }

    next[nextStatus] =
        (next[nextStatus] ?? 0) + 1;

    return next;
}

export function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export function formatGameDate(dateString) {
    if (!dateString) {
        return "TBD";
    }

    const [year, month, day] =
        dateString.split("-").map(Number);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return dateString;
    }

    const date = new Date(
        year,
        month - 1,
        day
    );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return dateString;
    }

    return date.toLocaleDateString(
        "en-US",
        {
            weekday: "short",
            month: "short",
            day: "numeric",
        }
    );
}

export function formatGameTime(timeString) {
    if (!timeString) {
        return "TBD";
    }

    const [hours, minutes] =
        timeString.split(":").map(Number);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return timeString;
    }

    const date = new Date(
        2000,
        0,
        1,
        hours,
        minutes,
        0,
        0
    );

    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
        }
    );
}