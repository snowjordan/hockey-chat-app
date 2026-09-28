import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ProfileEditor({ profile, onBack, onSaved }) {
  const [industries, setIndustries] = useState([])
  const [teamLoadError, setTeamLoadError] = useState('')

  const [teams, setTeams] = useState([])
  const [selectedSubTeamIds, setSelectedSubTeamIds] = useState([])
  const [subPreferencesLoading, setSubPreferencesLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    notes: profile?.notes ?? '',

    industry_name: '',
    company_name: '',
    description: '',
    is_available_for_work: true,
    linkedin_url: '',
    website_url: '',

    main_team_id: '',
    active_team_id: '',
    jersey_number: '',
    position: '',
  })

  useEffect(() => {
    async function loadFormData() {
      if (!profile?.id) {
        return
      }

      setSubPreferencesLoading(true)

      const [
        industriesResult,
        businessResult,
        teamMemberResult,
        teamsResult,
        subPreferencesResult,
        profileResult,
      ] = await Promise.all([
        supabase
          .from('industries')
          .select('id, name')
          .order('name'),

        supabase
          .from('profile_business_listings')
          .select(`
            id,
            industry_id,
            custom_industry,
            industries (name),
            company_name,
            description,
            is_available_for_work,
            linkedin_url,
            website_url
          `)
          .eq('profile_id', profile.id)
          .maybeSingle(),

        supabase
          .from('team_members')
          .select('id, team_id, jersey_number, position')
          .eq('profile_id', profile.id)
          .maybeSingle(),

        supabase
          .from('teams')
          .select('id, name')
          .order('name'),

        supabase
          .from('sub_team_preferences')
          .select('team_id')
          .eq('profile_id', profile.id),
        supabase.from('profiles').select('active_team_id').eq('id', profile.id).single(),
      ])

      if (industriesResult.error) {
        console.error(
          'Error loading industries:',
          industriesResult.error
        )
      } else {
        setIndustries(industriesResult.data ?? [])
      }

      if (businessResult.error) {
        console.error(
          'Error loading business listing:',
          businessResult.error
        )
      } else if (businessResult.data) {
        const businessData = businessResult.data

        setForm((current) => ({
          ...current,
          industry_name: businessData.custom_industry ?? businessData.industries?.name ?? '',
          company_name: businessData.company_name ?? '',
          description: businessData.description ?? '',
          is_available_for_work:
            businessData.is_available_for_work ?? true,
          linkedin_url: businessData.linkedin_url ?? '',
          website_url: businessData.website_url ?? '',
        }))
      }

      if (teamMemberResult.error) {
        console.error(
          'Error loading team information:',
          teamMemberResult.error
        )
      } else if (teamMemberResult.data) {
        const teamMemberData = teamMemberResult.data


        setForm((current) => ({
          ...current,
          main_team_id: String(teamMemberData.team_id),
          jersey_number: teamMemberData.jersey_number ?? '',
          position: teamMemberData.position ?? '',
        }))
      }

      if (teamsResult.error) {
        console.error(
          'Error loading teams:',
          teamsResult.error
        )
      } else {
        setTeams(teamsResult.data ?? [])
      }

      if (subPreferencesResult.error) {
        console.error(
          'Error loading sub-team preferences:',
          subPreferencesResult.error
        )
      } else {
        const selectedIds = (
          subPreferencesResult.data ?? []
        ).map((preference) => String(preference.team_id))

        setSelectedSubTeamIds(selectedIds)
      }

      if (teamMemberResult.error || teamsResult.error || subPreferencesResult.error || profileResult.error) {
        setTeamLoadError('Unable to load team settings. Reload before saving.')
      } else {
        setTeamLoadError('')
        setForm((current) => ({ ...current,
          active_team_id: String(profileResult.data.active_team_id ?? teamMemberResult.data?.team_id ?? ''),
        }))
      }
      setSubPreferencesLoading(false)
    }

    loadFormData()
  }, [profile?.id])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function normalizeUrl(value) {
    if (!value) {
      return null
    }

    const trimmed = value.trim()

    if (!trimmed) {
      return null
    }

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://')
    ) {
      return encodeURI(trimmed)
    }

    return encodeURI(`https://${trimmed}`)
  }

  function toggleSubTeam(teamId) {
    if (selectedSubTeamIds.includes(teamId) && form.active_team_id === teamId) {
      updateField('active_team_id', form.main_team_id)
    }
    setSelectedSubTeamIds((currentIds) => {
      if (currentIds.includes(teamId)) {
        return currentIds.filter((selectedId) => selectedId !== teamId)
      }

      return [...currentIds, teamId]
    })
  }

  async function handleSave() {
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      alert('Name, email, and phone are required.')
      return
    }

    setSaving(true)

      
    const { data: updatedProfile, error: profileError } =
      await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select()
        .single()

    if (profileError) {
      console.error('Error saving profile:', profileError)
      alert('Could not save profile.')
      setSaving(false)
      return
    }

    const spareTeamIds = selectedSubTeamIds.filter((id) => id !== form.main_team_id)
    const activeTeamId = form.active_team_id && [form.main_team_id, ...spareTeamIds].includes(form.active_team_id)
      ? form.active_team_id : form.main_team_id || spareTeamIds[0] || ''
    const { error: teamError } = await supabase.rpc('save_player_teams', {
      p_profile_id: String(profile.id),
      p_main_team_id: form.main_team_id || null,
      p_spare_team_ids: spareTeamIds,
      p_active_team_id: activeTeamId || null,
      p_jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
      p_position: form.position || null,
    })
    if (teamError) {
      console.error('Error saving team settings:', teamError)
      alert('Profile saved, but team settings could not be saved. Please try again.')
      setSaving(false)
      return
    }
    updatedProfile.active_team_id = activeTeamId || null

    const industryName = form.industry_name.trim()
    const selectedIndustry = industries.find(
      (industry) => industry.name.toLowerCase() === industryName.toLowerCase()
    )

    {
      const { error: businessError } = await supabase
        .from('profile_business_listings')
        .upsert(
          {
            profile_id: profile.id,
            industry_id: selectedIndustry?.id ?? null,
            custom_industry: selectedIndustry ? null : industryName || null,
            company_name: form.company_name.trim() || null,
            description: form.description.trim() || null,
            is_available_for_work: form.is_available_for_work,
            linkedin_url: normalizeUrl(form.linkedin_url),
            website_url: normalizeUrl(form.website_url),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'profile_id',
          }
        )

      if (businessError) {
        console.error(
          'Error saving business listing:',
          businessError
        )

        alert(
          'Profile saved, but the business listing could not be saved.'
        )

        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved?.(updatedProfile)
  }

  return (
    <div className="page-view player-detail-view">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Back to roster
      </button>

      <header className="page-header">
        <h2>Edit Profile</h2>

        <p className="page-subtitle">
          Update this player’s contact, team, and directory
          information.
        </p>
      </header>

      <div className="profile-sections-panel">
        <section className="content-card profile-card">
          <header className="content-card-header">
            <h2>Contact Information</h2>
          </header>

          <div className="profile-form-grid">
            <label className="form-field">
              <span>Name *</span>

              <input
                value={form.full_name}
                onChange={(event) =>
                  updateField(
                    'full_name',
                    event.target.value
                  )
                }
              />
            </label>

            <label className="form-field">
              <span>Email *</span>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField('email', event.target.value)
                }
              />
            </label>

            <label className="form-field">
              <span>Phone *</span>

              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className="content-card profile-card">
          <header className="content-card-header">
            <h2>Team Information</h2>
          </header>

          <div className="profile-form-grid">
            <label className="form-field">
              <span>Main team</span>
              <select value={form.main_team_id} onChange={(event) => {
                const teamId = event.target.value
                updateField('main_team_id', teamId)
                setSelectedSubTeamIds((ids) => ids.filter((id) => id !== teamId))
                updateField('active_team_id', teamId)
              }}>
                <option value="">No main team</option>
                {teams.map((team) => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Viewing team</span>
              <select value={form.active_team_id} onChange={(event) => updateField('active_team_id', event.target.value)}>
                <option value="">Use main team</option>
                {teams.filter((team) => String(team.id) === form.main_team_id || selectedSubTeamIds.includes(String(team.id))).map((team) => (
                  <option key={team.id} value={String(team.id)}>{team.name}{String(team.id) === form.main_team_id ? ' (Main)' : ' (Spare)'}</option>
                ))}
              </select>
              <small>Choose whose schedule and tonight's roster you want to see.</small>
            </label>
            <label className="form-field">
              <span>Jersey Number</span>

              <input
                type="number"
                value={form.jersey_number}
                onChange={(event) =>
                  updateField(
                    'jersey_number',
                    event.target.value
                  )
                }
                placeholder="11"
              />
            </label>

            <label className="form-field">
              <span>Position</span>

              <select
                  value={form.position ?? ""}
                  onChange={(event) =>
                      updateField('position', event.target.value)
                  }
              >

                  <option value="">Select position</option>
                  <option value="forward">Forward</option>
                  <option value="defense">Defense</option>
                  <option value="goalie">Goalie</option>
              </select>
            </label>
          </div>
        </section>

        <section className="content-card profile-card sub-availability-card">
          <header className="content-card-header">
            <div>
              <h2>Spare Teams</h2>

              <p className="sub-availability-description">
                Select teams to appear in their Spares list.
              </p>
            </div>
          </header>

          {subPreferencesLoading ? (
            <p>Loading teams...</p>
          ) : teams.length === 0 ? (
            <p>No teams are currently available.</p>
          ) : (
            <div className="sub-team-options">
              {teams.filter((team) => String(team.id) !== form.main_team_id).map((team) => (
                <label
                  className="sub-team-option"
                  key={team.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedSubTeamIds.includes(String(team.id))}
                    onChange={() =>
                      toggleSubTeam(String(team.id))
                    }
                  />

                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="content-card profile-card">
          <header className="content-card-header">
            <h2>Business Directory Listing</h2>
          </header>

          <div className="profile-form-grid">
            <label className="form-field">
              <span>Industry</span>

              <input
                type="text"
                list="industry-options"
                value={form.industry_name}
                onChange={(event) =>
                  updateField('industry_name', event.target.value)
                }
                placeholder="Select or type your industry"
              />
              <datalist id="industry-options">
                {industries.map((industry) => (
                  <option key={industry.id} value={industry.name} />
                ))}
              </datalist>
            </label>

            <label className="form-field">
              <span>Company Name</span>

              <input
                value={form.company_name}
                onChange={(event) =>
                  updateField(
                    'company_name',
                    event.target.value
                  )
                }
              />
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.is_available_for_work}
                onChange={(event) =>
                  updateField(
                    'is_available_for_work',
                    event.target.checked
                  )
                }
              />

              <span>Available for work</span>
            </label>

            <label className="form-field">
              <span>LinkedIn URL</span>

              <input
                type="url"
                value={form.linkedin_url}
                onChange={(event) =>
                  updateField(
                    'linkedin_url',
                    event.target.value
                  )
                }
                placeholder="https://linkedin.com/in/name"
              />
            </label>

            <label className="form-field">
              <span>Company Website</span>

              <input
                type="url"
                value={form.website_url}
                onChange={(event) =>
                  updateField(
                    'website_url',
                    event.target.value
                  )
                }
                placeholder="https://company.com"
              />
            </label>

            <label className="form-field form-field--full">
              <span>Business Description</span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField(
                    'description',
                    event.target.value
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="content-card profile-card">
          <header className="content-card-header">
            <h2>Notes</h2>
          </header>

          <div className="profile-form-grid">
            <label className="form-field form-field--full">
              <span>Optional notes</span>

              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField('notes', event.target.value)
                }
                placeholder="Add anything else you want to remember about this player"
              />
            </label>
          </div>
        </section>
      </div>

      {teamLoadError && <p role="alert">{teamLoadError}</p>}
      <div className="profile-actions">
        <button
          type="button"
          className="action-btn action-btn--primary"
          onClick={handleSave}
          disabled={saving || subPreferencesLoading || Boolean(teamLoadError)}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}