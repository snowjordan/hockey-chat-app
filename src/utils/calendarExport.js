const encoder = new TextEncoder();

function escapeText(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\r|\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
}

function foldLine(line) {
    const lines = [""];
    let bytes = 0;

    for (const character of line) {
        const size = encoder.encode(character).length;
        if (bytes + size > 75) {
            lines.push(" ");
            bytes = 1;
        }
        lines[lines.length - 1] += character;
        bytes += size;
    }

    return lines.join("\r\n");
}

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
}

function validTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
    const [hours, minutes, seconds = 0] = value.split(":").map(Number);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return { hours, minutes, seconds };
}

function formatDate(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatTime(time) {
    return [time.hours, time.minutes, time.seconds].map((part) => String(part).padStart(2, "0")).join("");
}

export function buildScheduleIcs(games, now = new Date()) {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Hockey Chat App//Schedule Export//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Hockey Schedule",
    ];

    for (const game of games) {
        const date = validDate(game.game_date);
        if (!date) continue;

        const start = validTime(game.start_time);
        const end = validTime(game.end_time);
        const dateKey = formatDate(date);
        const location = [game.location_name, game.rink].filter(Boolean).join(" - ");
        const summary = `${game.home_team_name || "TBD"} vs ${game.away_team_name || "TBD"}`;
        const uid = `${game.id || `${dateKey}-${formatTime(start || { hours: 0, minutes: 0, seconds: 0 })}-${summary}`}@hockey-chat-app`;

        lines.push("BEGIN:VEVENT", `UID:${escapeText(uid)}`, `DTSTAMP:${stamp}`);

        if (start) {
            // Floating times preserve the clock time shown in the app when imported.
            const endDate = new Date(date);
            let endTime = end;
            if (!endTime) {
                endTime = { ...start, hours: (start.hours + 1) % 24 };
                if (start.hours === 23) endDate.setUTCDate(endDate.getUTCDate() + 1);
            } else if (
                end.hours < start.hours ||
                (end.hours === start.hours && end.minutes < start.minutes) ||
                (end.hours === start.hours && end.minutes === start.minutes && end.seconds <= start.seconds)
            ) {
                endDate.setUTCDate(endDate.getUTCDate() + 1);
            }
            lines.push(`DTSTART:${dateKey}T${formatTime(start)}`, `DTEND:${formatDate(endDate)}T${formatTime(endTime)}`);
        } else {
            const nextDate = new Date(date);
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
            lines.push(`DTSTART;VALUE=DATE:${dateKey}`, `DTEND;VALUE=DATE:${formatDate(nextDate)}`);
        }

        lines.push(`SUMMARY:${escapeText(summary)}`);
        if (location) lines.push(`LOCATION:${escapeText(location)}`);
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadScheduleIcs(games, teamName) {
    const blob = new Blob([buildScheduleIcs(games)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = String(teamName || "hockey").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${slug || "hockey-schedule"}-schedule.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
