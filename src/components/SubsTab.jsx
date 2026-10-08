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
  const [search, setSearch] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const [listError, setListError] = useState('')
  const [teamsError, setTeamsError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadCurrentUserAvailability() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      setAvailabilityError('Could not load your availability. Please refresh to try again.')
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
      setAvailabilityError('Could not load your availability. Please refresh to try again.')
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
      setAvailabilityError('Could not find your profile.')
      return
    }

    setUpdatingAvailability(true)
    setAvailabilityError('')
    setNotice('')

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

      setAvailabilityError('Could not update your goalie availability. Please try again.')

      setUpdatingAvailability(false)
      return
    }

    setNotice(isAvailable ? 'You are now available as a goalie sub.' : 'You are no longer listed as an available goalie sub.')
    setIsAvailableToGoalieSub(isAvailable)
    setUpdatingAvailability(false)

    await loadAvailableSubs()
  }

  async function handleAvailabilityChange(isAvailable) {
    if (!currentProfileId) {
      setAvailabilityError('Could not find your profile.')
      return
    }

    setUpdatingAvailability(true)
    setAvailabilityError('')
    setNotice('')

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

      setAvailabilityError('Could not update your sub availability. Please try again.')
      setUpdatingAvailability(false)
      return
    }

    setNotice(isAvailable ? 'You are now available as a general sub.' : 'You are no longer listed as an available general sub.')
    setIsAvailableToSub(isAvailable)
    setUpdatingAvailability(false)

    await loadAvailableSubs()
  }



  async function loadAvailableSubs() {

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
      setListError('Could not load available subs. Please try again.')
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
      (firstSub.fullName ?? '').localeCompare(
        secondSub.fullName ?? ''
      )
    )

    setListError('')
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
        setTeamsError('Team filters could not be loaded. You can still search all subs.')
        setAllTeams([])
        return
  }

    setAllTeams(teamData ?? [])
    }

  useEffect(() => {
    async function loadAvailability() {
      try {
        await Promise.all([loadCurrentUserAvailability(), loadAvailableSubs(), loadAllTeams()])
      } finally {
        setAvailabilityLoading(false)
      }
    }
    loadAvailability()

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

  const filteredSubs = subsForActiveTab.filter((sub) =>
    (selectedTeamFilter === 'all' || sub.selectedTeams.some((team) => String(team.id) === selectedTeamFilter))
    && (sub.fullName ?? '').toLowerCase().includes(search.trim().toLowerCase())
  )
  const hasFilters = search !== '' || selectedTeamFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setSelectedTeamFilter('all')
  }

  return (
    <div className="page-view subs-page">
      <header className="page-header">
        <h2>Available Subs</h2>
        <p className="page-subtitle">Find a player for your next game, or let teams know you can fill in.</p>
      </header>

      <section className="content-card" aria-labelledby="sub-availability-heading" aria-busy={updatingAvailability || availabilityLoading}>
        <header className="content-card-header">
          <h2 id="sub-availability-heading">My availability</h2>
          <span className="content-card-meta">Keep teams in the loop</span>
        </header>
        <p className="page-subtitle">Choose how you can help. Set the teams you are willing to sub for in your profile.</p>
        {availabilityError && <p className="admin-save-error" role="alert">{availabilityError}</p>}
        {notice && <p className="subs-feedback" role="status">{notice}</p>}
        {availabilityLoading ? <p className="empty-state" role="status">Loading your availability...</p> : <>
          <div className="subs-availability-grid">
            {[
              { key: 'general', label: 'General sub', detail: 'Fill in for a team as a player.', checked: isAvailableToSub, onChange: handleAvailabilityChange },
              { key: 'goalies', label: 'Goalie sub', detail: 'Help a team that needs a goalie.', checked: isAvailableToGoalieSub, onChange: handleGoalieAvailabilityChange },
            ].map((option) => <label key={option.key} className={`subs-availability-option${option.checked ? ' is-available' : ''}`}>
              <input type="checkbox" checked={option.checked} disabled={!currentProfileId || updatingAvailability}
                onChange={(event) => option.onChange(event.target.checked)} />
              <span className="subs-availability-copy">
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
                <span className="subs-availability-state">{option.checked ? 'Available' : 'Not available'}</span>
              </span>
            </label>)}
          </div>
          {!currentProfileId && !availabilityError && <p className="page-subtitle">Your signed-in account is not linked to a player profile.</p>}
        </>}
        {updatingAvailability && <p role="status">Saving availability...</p>}
      </section>

      <section className="content-card" aria-labelledby="subs-directory-heading">
        <header className="content-card-header">
          <h2 id="subs-directory-heading">Find a sub</h2>
          <span className="content-card-meta" role="status">{loading ? 'Loading...' : listError ? 'Unavailable' : `${filteredSubs.length} ${filteredSubs.length === 1 ? 'player' : 'players'} found`}</span>
        </header>
        <div className="subs-category-options" role="group" aria-label="Sub category">
          {[{ key: 'general', label: 'General subs', count: generalSubs.length }, { key: 'goalies', label: 'Goalies', count: goalieSubs.length }].map((category) =>
            <button type="button" key={category.key} aria-pressed={activeSubTab === category.key}
              className={`action-btn ${activeSubTab === category.key ? 'action-btn--primary' : 'action-btn--secondary'}`}
              onClick={() => setActiveSubTab(category.key)}>
              {category.label}{!loading && !listError && <span className="subs-category-count">{category.count}</span>}
            </button>
          )}
        </div>
        <div className="subs-directory-filters">
          <div className="form-field">
            <label htmlFor="subs-search">Find a player</label>
            <input id="subs-search" type="search" placeholder="Search by name" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="subs-team">Available for team</label>
            <select id="subs-team" value={selectedTeamFilter} onChange={(event) => setSelectedTeamFilter(event.target.value)}>
              <option value="all">All teams</option>
              {allTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          {hasFilters && <button type="button" className="action-btn action-btn--outline" onClick={clearFilters}>Clear filters</button>}
        </div>
        {teamsError && <p className="admin-save-error" role="alert">{teamsError}</p>}
        {loading ? <p className="subs-empty" role="status">Loading available subs...</p>
          : listError ? <div className="subs-empty"><p role="alert">{listError}</p><button type="button" className="action-btn action-btn--outline" onClick={() => { setLoading(true); loadAvailableSubs() }}>Try again</button></div>
          : filteredSubs.length === 0 ? <div className="subs-empty">
            <strong>{hasFilters ? 'No matching subs' : activeSubTab === 'goalies' ? 'No goalies available right now' : 'No subs available right now'}</strong>
            <p>{hasFilters ? 'Try another name or team, or clear your filters.' : 'Check back later as players update their availability.'}</p>
            {hasFilters && <button type="button" className="action-btn action-btn--outline" onClick={clearFilters}>Show all {activeSubTab === 'goalies' ? 'goalies' : 'general subs'}</button>}
          </div>
          : <div className="subs-player-grid">
            {filteredSubs.map((sub) => <article className="subs-player-card" key={sub.profileId}>
              <header className="subs-player-heading">
                <div className="subs-avatar" aria-hidden="true">{(sub.fullName ?? '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</div>
                <div><h3>{sub.fullName || 'Unnamed player'}</h3><span className="subs-available-badge">Available{activeSubTab === 'goalies' ? ' as goalie' : ''}</span></div>
              </header>
              <dl className="subs-player-details">
                <div><dt>Roster position</dt><dd>{sub.position}</dd></div>
                <div><dt>Regular team</dt><dd>{sub.regularTeam}</dd></div>
              </dl>
              <div className="subs-player-teams">
                <h4>Available for</h4>
                <div className="sub-team-list">{sub.selectedTeams.map((team) => <span className="sub-team-badge" key={team.id}>{team.name}</span>)}</div>
              </div>
              <footer className="subs-contact">
                {sub.phone ? <>
                  <span className="subs-phone">{sub.phone}</span>
                  <div className="subs-contact-actions">
                    <a className="action-btn action-btn--primary" href={`tel:${sub.phone}`} aria-label={`Call ${sub.fullName}`}>Call</a>
                    <a className="action-btn action-btn--outline" href={`sms:${sub.phone}`} aria-label={`Text ${sub.fullName}`}>Text</a>
                  </div>
                </> : <span className="subs-phone">No phone number provided</span>}
              </footer>
            </article>)}
          </div>}
      </section>
    </div>
  )
}
