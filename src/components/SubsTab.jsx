import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SubsTab() {
  const [availableSubs, setAvailableSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentProfileId, setCurrentProfileId] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('general')
  const [isAvailableToGoalieSub, setIsAvailableToGoalieSub] = useState(false)
  const [isAvailableToSub, setIsAvailableToSub] = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all')
  const [allTeams, setAllTeams] = useState([])

  async function loadCurrentUserAvailability() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('Error loading signed-in user:', userError)
      return
    }

    if (!user) {
      return
    }

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, is_available_to_sub, is_available_to_goalie_sub')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error(
        'Error loading current profile availability:',
        profileError
      )
      return
    }

    if (!profileData) {
      return
    }

    setCurrentProfileId(profileData.id)
    setIsAvailableToSub(
      profileData.is_available_to_sub ?? false
    )
    setIsAvailableToGoalieSub(profileData.is_available_to_goalie_sub ?? false)
  }



  async function handleGoalieAvailabilityChange(
    isAvailable
  ) {
    if (!currentProfileId) {
      alert('Could not find your profile.')
      return
    }

    setUpdatingAvailability(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        is_available_to_goalie_sub: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentProfileId)

    if (error) {
      console.error(
        'Error updating goalie sub availability:',
        error
      )

      alert(
        'Could not update your goalie sub availability.'
      )

      setUpdatingAvailability(false)
      return
    }

    setIsAvailableToGoalieSub(isAvailable)
    setUpdatingAvailability(false)

    await loadAvailableSubs()
  }

  async function handleAvailabilityChange(isAvailable) {
    if (!currentProfileId) {
      alert('Could not find your profile.')
      return
    }

    setUpdatingAvailability(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_available_to_sub: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentProfileId)

    if (updateError) {
      console.error(
        'Error updating sub availability:',
        updateError
      )

      alert('Could not update your sub availability.')
      setUpdatingAvailability(false)
      return
    }

    setIsAvailableToSub(isAvailable)
    setUpdatingAvailability(false)

    await loadAvailableSubs()
  }



  async function loadAvailableSubs() {
    setLoading(true)

    const {
      data: subPreferenceData,
      error: subPreferenceError,
    } = await supabase
      .from('sub_team_preferences')
      .select(`
        profile_id,
        team_id,

        profiles!inner (
          id,
          full_name,
          phone,
          is_available_to_sub,
          is_available_to_goalie_sub,

          team_members (
            position,

            teams (
              id,
              name
            )
          )
        ),

        teams (
          id,
          name
        )
      `)
      .order('created_at')

    if (subPreferenceError) {
      console.error(
        'Error loading available subs:',
        subPreferenceError
      )

      setAvailableSubs([])
      setLoading(false)
      return
    }

    const subsByProfile = new Map()

    for (const preference of subPreferenceData ?? []) {
      const profile = preference.profiles

      if (!profile) {
        continue
      }

      const existingSub = subsByProfile.get(profile.id)

      if (existingSub) {
        if (preference.teams) {
          existingSub.selectedTeams.push(preference.teams)
        }

        continue
      }

      const rosterMembership =
        profile.team_members?.[0] ?? null

      subsByProfile.set(profile.id, {
        profileId: profile.id,
        fullName: profile.full_name,
        phone: profile.phone,

        isAvailableToSub:
          profile.is_available_to_sub ?? false,
        isAvailableToGoalieSub:
          profile.is_available_to_goalie_sub ?? false,
        position:
          rosterMembership?.position ?? 'Not provided',
        regularTeam:
          rosterMembership?.teams?.name ??
          'No regular team',
        selectedTeams: preference.teams
          ? [preference.teams]
          : [],
      })
    }

    const formattedSubs = Array.from(
      subsByProfile.values()
    ).sort((firstSub, secondSub) =>
      firstSub.fullName.localeCompare(
        secondSub.fullName
      )
    )

    setAvailableSubs(formattedSubs)
    setLoading(false)
  }

  async function loadAllTeams() {
    const { data: teamData, error: teamError} = await supabase
        .from('teams')
        .select('id, name')
        .order('name')

    if (teamError) {
        console.error('Error loading teams:', teamError)
        setAllTeams([])
        return
  }

    setAllTeams(teamData ?? [])
    }

  useEffect(() => {
    loadCurrentUserAvailability()
    loadAvailableSubs()
    loadAllTeams()

    const subPreferencesChannel = supabase
      .channel('sub-team-preferences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sub_team_preferences',
        },
        () => {
          loadAvailableSubs()
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            'Sub preference subscription error:',
            error
          )
        }
      })

    const profilesChannel = supabase
      .channel('profile-sub-availability-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          loadAvailableSubs()
          loadCurrentUserAvailability()
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            'Profile availability subscription error:',
            error
          )
        }
      })

    return () => {
      supabase.removeChannel(subPreferencesChannel)
      supabase.removeChannel(profilesChannel)
    }
  }, [])

  const generalSubs = availableSubs.filter((sub) => sub.isAvailableToSub)
  const goalieSubs = availableSubs.filter((sub) => sub.isAvailableToGoalieSub)
  const subsForActiveTab =
    activeSubTab === 'goalies'
      ? goalieSubs
      : generalSubs

  const filteredSubs =
    selectedTeamFilter === 'all'
        ? subsForActiveTab
        : subsForActiveTab.filter((sub) =>
            sub.selectedTeams.some(
                (team) => team.id === selectedTeamFilter
            )
        )

  return (
    <div className="subs-page">
      <header className="page-header">
        <div className='sub-type-tabs'>
          <button
            type='button'
            className={`action-btn ${
              activeSubTab === 'general'
                ? 'action-btn--primary'
                : 'action-btn--secondary'
            }`}
            onClick={() => setActiveSubTab('general')}
          >
            General
          </button>

          <button
              type="button"
              className={`action-btn ${
                activeSubTab === 'goalies'
                  ? 'action-btn--primary'
                  : 'action-btn--secondary'
              }`}
              onClick={() => setActiveSubTab('goalies')}
          >
              Goalies
          </button>
        </div>
        <div>
          <h2>Available Subs</h2>

          <p className="page-subtitle">
            Players who are currently available and have
            selected teams they are willing to substitute for.
          </p>
        </div>
      </header>

      <section className="content-card">
        <header className="content-card-header">
          <div>
            <h2>My Sub Availability</h2>

            <p className="page-subtitle">
              Turn this on when you are currently available to
              substitute.
            </p>
          </div>
        </header>
        
        {activeSubTab === 'general' && (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={isAvailableToSub}
            disabled={
              !currentProfileId || updatingAvailability
            }
            onChange={(event) =>
              handleAvailabilityChange(
                event.target.checked
              )
            }
          />

          <span>
            {updatingAvailability
              ? 'Updating availability...'
              : 'I am available to sub'}
          </span>
        </label>
        )}

        {activeSubTab === 'goalies' && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={isAvailableToGoalieSub}
              disabled={
                !currentProfileId ||
                updatingAvailability
              }
              onChange={(event) =>
                handleGoalieAvailabilityChange(
                  event.target.checked
                )
              }
            />

            <span>I am available to sub as goalie</span>
          </label>
        )}

        {!currentProfileId && (
          <p className="page-subtitle">
            Your signed-in account is not linked to a player
            profile.
          </p>
        )}
      </section>

      <section className="content-card">
        <div className="subs-filter-row">
            <label className='form-field subs-team-filter'>
                <span>Filter by team</span>

                <select
                    value={selectedTeamFilter}
                    onChange={(event) =>
                    setSelectedTeamFilter(event.target.value)
                    }
                >
                    <option value="all">All teams</option>

                    {allTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                            {team.name}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    </section>

      {loading ? (
        <section className="content-card">
          <p>Loading available subs...</p>
        </section>
      ) : filteredSubs.length === 0 ? (
        <section className="content-card">
          <p>
            {selectedTeamFilter === 'all'
                ? 'No players are currently available to sub.'
                : 'No players are currently available for this team.'}
          </p>
        </section>
      ) : (
        <section className="content-card">
          <div className="table-scroll">
            <table className="subs-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Position</th>
                  <th>Regular Team</th>
                  <th>Phone</th>
                  <th>Teams Available For</th>
                </tr>
              </thead>

              <tbody>
                {filteredSubs.map((sub) => (
                  <tr key={sub.profileId}>
                    <td>{sub.fullName}</td>
                    <td>{sub.position}</td>
                    <td>{sub.regularTeam}</td>

                    <td>
                      {sub.phone ? (
                        <a href={`tel:${sub.phone}`}>
                          {sub.phone}
                        </a>
                      ) : (
                        'Not provided'
                      )}
                    </td>

                    <td>
                      <div className="sub-team-list">
                        {sub.selectedTeams.map((team) => (
                          <span
                            className="sub-team-badge"
                            key={team.id}
                          >
                            {team.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}