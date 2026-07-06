import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TeamsDirectory() {
    const [teams, setTeams] = useState([])

    useEffect(() => {
        async function loadTeams() {
            const { data, error } = await supabase
                .from('teams')
                .select(`
                    id,
                    name,
                    league_name,
                    team_members (
                        id,
                        jersey_number,
                        position,
                        profiles (
                            id,
                            full_name,
                            email,
                            phone,
                            notes
                            )
                        )
                    `)
                
                    if (error) {
                        console.error(error)
                    } else {
                        setTeams(data)
                    } 
                }

                loadTeams()
            }, [])
            return (
                <div className="page-view teams-view">
                    <header className="page-header">
                        <h2>Teams</h2>
                        <p className="page-subtitle">League teams and  player rosters</p>
                    </header>

                     <div className="teams-grid teams-grid--page">
                        {teams.map((team) => (
                        <article key={team.id} className="team-card">
                            <h3 className="team-card-name">{team.name}</h3>
                            <p className="team-card-count">
                                {team.team_members?.length ?? 0} players
                            </p>
                        </article>
                    ))}
                </div>
            </div>
        )
}