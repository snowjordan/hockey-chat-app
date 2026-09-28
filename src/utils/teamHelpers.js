export function attachSparePlayers(teams, preferences) {
  const members = teams.flatMap((team) => team.team_members ?? [])
  return teams.map((team) => {
    const mainIds = new Set((team.team_members ?? []).map((member) => member.profiles?.id))
    const seen = new Set(mainIds)
    const spares = preferences.filter((entry) => String(entry.team_id) === String(team.id)).flatMap((entry) => {
      const profile = entry.profiles
      if (!profile || seen.has(profile.id)) return []
      seen.add(profile.id)
      const main = members.find((member) => member.profiles?.id === profile.id)
      return [{ ...main, id: `spare-${team.id}-${profile.id}`, profile_id: profile.id, profiles: profile, is_spare: true }]
    })
    spares.sort((a, b) => (a.profiles.full_name ?? '').localeCompare(b.profiles.full_name ?? ''))
    return { ...team, spares }
  })
}

export function findViewingTeam(teams, profile) {
  const belongs = (members) => (members ?? []).some((member) => member.profiles?.id === profile?.id)
  const main = teams.find((team) => belongs(team.team_members))
  return teams.find((team) => String(team.id) === String(profile?.active_team_id)
    && (belongs(team.team_members) || belongs(team.spares))) ?? main
    ?? teams.find((team) => belongs(team.spares)) ?? null
}
