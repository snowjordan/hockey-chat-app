// Demo data for prototype only. Replace with real backend data later.

export const CURRENT_USER_ID = "player-1";
export const CURRENT_TEAM_ID = "team-1";

const redBricksRoster = [
    { id: "player-1", name: "Alex Smith", number: 21, position: "Forward", phone: "555-123-4567", email: "alex@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-2", name: "Robert Jones", number: 12, position: "Goalie", phone: "555-987-6543", email: "robert@example.com", notes: "", rsvp: "going", isGoalie: true },
    { id: "player-4", name: "Mike Chen", number: 7, position: "Forward", phone: "555-111-2222", email: "mike@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-5", name: "Chris Davis", number: 19, position: "Defense", phone: "555-222-3333", email: "chris@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-6", name: "Jordan Lee", number: 44, position: "Forward", phone: "555-333-4444", email: "jordan@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-7", name: "Pat O'Brien", number: 8, position: "Defense", phone: "555-444-5555", email: "pat@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-8", name: "Taylor Kim", number: 15, position: "Forward", phone: "555-555-6666", email: "taylor@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-9", name: "Drew Martinez", number: 27, position: "Defense", phone: "555-666-7777", email: "drew@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-10", name: "Casey Walsh", number: 33, position: "Forward", phone: "555-777-8888", email: "casey@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-11", name: "Jamie Foster", number: 5, position: "Forward", phone: "555-888-9999", email: "jamie@example.com", notes: "", rsvp: "maybe", isGoalie: false },
    { id: "player-12", name: "Riley Brooks", number: 18, position: "Defense", phone: "555-999-0000", email: "riley@example.com", notes: "", rsvp: "maybe", isGoalie: false },
    { id: "player-13", name: "Morgan Hayes", number: 22, position: "Forward", phone: "555-000-1111", email: "morgan@example.com", notes: "", rsvp: "out", isGoalie: false },
    { id: "player-14", name: "Quinn Reed", number: 11, position: "Defense", phone: "555-101-2020", email: "quinn@example.com", notes: "", rsvp: "out", isGoalie: false },
    { id: "player-15", name: "Avery Clark", number: 9, position: "Forward", phone: "555-202-3030", email: "avery@example.com", notes: "", rsvp: "pending", isGoalie: false },
    { id: "player-16", name: "Blake Turner", number: 30, position: "Goalie", phone: "555-303-4040", email: "blake@example.com", notes: "Backup goalie", rsvp: "pending", isGoalie: true },
];

const varsityRoster = [
    { id: "player-3", name: "Sam Miller", number: 9, position: "Forward", phone: "555-222-3333", email: "sam@example.com", notes: "", rsvp: "maybe", isGoalie: false },
    { id: "player-v2", name: "Nick Torres", number: 14, position: "Forward", phone: "555-404-5050", email: "nick@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-v3", name: "Evan Price", number: 6, position: "Defense", phone: "555-505-6060", email: "evan@example.com", notes: "", rsvp: "going", isGoalie: false },
    { id: "player-v4", name: "Logan Pierce", number: 17, position: "Goalie", phone: "555-606-7070", email: "logan@example.com", notes: "", rsvp: "pending", isGoalie: true },
    { id: "player-v5", name: "Hayden Cole", number: 23, position: "Forward", phone: "555-707-8080", email: "hayden@example.com", notes: "", rsvp: "out", isGoalie: false },
    { id: "player-v6", name: "Cameron West", number: 4, position: "Defense", phone: "555-808-9090", email: "cameron@example.com", notes: "", rsvp: "maybe", isGoalie: false },
];

export const demoLeague = {
    name: "CEO League",
    alerts: [
        {
            id: "alert-1",
            title: "Schedule update",
            message: "Game times for June 15 have been confirmed. Doors open 30 minutes before puck drop.",
            summary: "June 15 game times confirmed.",
            date: "June 10",
            relatedGameId: "game-1",
        },
        {
            id: "alert-2",
            title: "Rink change reminder",
            message: "South Suburban requires skaters to check in at the front desk before heading to the locker room.",
            summary: "Check-in required at South Suburban.",
            date: "June 12",
            relatedGameId: "game-1",
        },
    ],
    feed: [
        { id: "feed-1", type: "schedule_change", title: "Schedule update", message: "Game times for June 15 have been confirmed.", date: "June 10" },
        { id: "feed-2", type: "attendance_update", title: "Red Bricks attendance", message: "Mike Chen marked Going for June 15.", date: "June 12" },
        { id: "feed-3", type: "attendance_update", title: "Red Bricks attendance", message: "Jamie Foster marked Maybe for June 15.", date: "June 12" },
        { id: "feed-4", type: "goalie_request", title: "Goalie needed", message: "Varsity Inn still needs a goalie for June 15.", date: "June 13" },
        { id: "feed-5", type: "substitute_request", title: "Sub needed", message: "Red Bricks is looking for 1 sub for June 15.", date: "June 13" },
        { id: "feed-6", type: "roster_update", title: "Roster change", message: "Avery Clark added to Red Bricks roster.", date: "June 11" },
        { id: "feed-7", type: "chat_activity", title: "New message in #Game Day", message: "Team chat has new activity.", date: "June 14" },
    ],
    teams: [
        {
            id: "team-1",
            name: "Red Bricks",
            roster: redBricksRoster,
            attendance: { going: 9, maybe: 2, out: 2, noResponse: 2 },
            goalieStatus: "Goalie confirmed",
            substituteStatus: "Need 1 sub",
        },
        {
            id: "team-2",
            name: "Varsity Inn",
            roster: varsityRoster,
            attendance: { going: 2, maybe: 2, out: 1 },
            goalieStatus: "Goalie needed",
            substituteStatus: "No subs needed",
        },
    ],
    games: [
        {
            id: "game-1",
            homeTeamId: "team-1",
            awayTeamId: "team-2",
            date: "June 15",
            time: "7:00 PM",
            location: "South Suburban",
            attendance: { going: 11, maybe: 4, out: 3 },
            goalieStatus: "Goalie confirmed",
            substituteStatus: "Need 1 sub",
        },
        {
            id: "game-2",
            homeTeamId: "team-2",
            awayTeamId: "team-1",
            date: "June 22",
            time: "8:30 PM",
            location: "Ice Ranch",
            attendance: { going: 0, maybe: 0, out: 0 },
            goalieStatus: "Not set",
            substituteStatus: "No subs needed",
        },
        {
            id: "game-3",
            homeTeamId: "team-1",
            awayTeamId: "team-2",
            date: "June 29",
            time: "6:45 PM",
            location: "Family Sports",
            attendance: { going: 0, maybe: 0, out: 0 },
            goalieStatus: "Not set",
            substituteStatus: "No subs needed",
        },
    ],
    standings: [],
    chats: [
        { id: "chat-1", name: "Test", messages: [] },
        { id: "chat-2", name: "Red Bricks", messages: [] },
        { id: "chat-3", name: "Game Day", messages: [] },
    ],
};
