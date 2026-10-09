// Build sections from the team list and explicit roster assignments, not nested joins.
export function groupEmailRecipients(profiles, teams, memberships, { search = '', captainsOnly = false, captainIds = new Set() } = {}) {
    const query = search.trim().toLowerCase();
    const byId = new Map(profiles.map((profile) => [String(profile.id), profile]));
    const groups = new Map(teams.map((team) => [String(team.id), { id: String(team.id), name: team.name || 'Unnamed team', members: new Map() }]));
    const assigned = new Set();
    for (const membership of memberships) {
        const group = groups.get(String(membership.team_id));
        const profile = byId.get(String(membership.profile_id));
        if (!group || !profile) continue;
        group.members.set(String(profile.id), profile);
        assigned.add(String(profile.id));
    }
    const unassigned = profiles.filter((profile) => !assigned.has(String(profile.id)));
    const sections = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    if (unassigned.length) sections.push({ id: 'unassigned', name: 'No team assigned', members: new Map(unassigned.map((profile) => [String(profile.id), profile])) });
    return sections.map((section) => ({
        ...section,
        members: [...section.members.values()].filter((profile) => (!captainsOnly || captainIds.has(profile.id))
            && (!query || section.name.toLowerCase().includes(query)
                || [profile.full_name, profile.email].some((value) => value?.toLowerCase().includes(query))))
            .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', undefined, { sensitivity: 'base' })),
    })).filter((section) => (!query && !captainsOnly) || section.members.length > 0);
}
