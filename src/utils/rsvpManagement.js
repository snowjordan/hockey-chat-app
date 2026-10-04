export function manageableTeams(teams, access) {
    return teams.filter((team) => access?.is_admin === true
        || (access?.team_ids ?? []).some((id) => String(id) === String(team.id)));
}

export function gamesForManagedTeam(games, teamId) {
    if (!teamId) return [];
    return games.filter((game) => String(game.home_team_id) === String(teamId)
        || String(game.away_team_id) === String(teamId));
}
