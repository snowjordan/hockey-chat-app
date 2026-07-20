import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ProfileEditor({ profile, onBack, onSaved }) {
  const [industries, setIndustries] = useState([])
  const [teamMember, setTeamMember] = useState(null)

  const [teams, setTeams] = useState([])
  const [selectedSubTeamIds, setSelectedSubTeamIds] = useState([])
  const [subPreferencesLoading, setSubPreferencesLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    notes: profile?.notes ?? '',

    industry_id: '',
    company_name: '',
    description: '',
    is_available_for_work: true,
    linkedin_url: '',
    website_url: '',

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
          industry_id: businessData.industry_id ?? '',
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

        setTeamMember(teamMemberData)

        setForm((current) => ({
          ...current,
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
        ).map((preference) => preference.team_id)

        setSelectedSubTeamIds(selectedIds)
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
    setSelectedSubTeamIds((currentIds) => {
      if (currentIds.includes(teamId)) {
        return currentIds.filter(
          (selectedId) => selectedId !== teamId
        )
      }

      return [...currentIds, teamId]
    })
  }

  async function saveSubTeamPreferences() {
    const { error: deleteError } = await supabase
      .from('sub_team_preferences')
      .delete()
      .eq('profile_id', profile.id)

    if (deleteError) {
      console.error(
        'Error removing previous sub-team preferences:',
        deleteError
      )

      return {
        error: deleteError,
      }
    }

    if (selectedSubTeamIds.length === 0) {
      return {
        error: null,
      }
    }

    const preferenceRows = selectedSubTeamIds.map((teamId) => ({
      profile_id: profile.id,
      team_id: teamId,
    }))

    const { error: insertError } = await supabase
      .from('sub_team_preferences')
      .insert(preferenceRows)

    if (insertError) {
      console.error(
        'Error saving sub-team preferences:',
        insertError
      )
    }

    return {
      error: insertError,
    }
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

    if (teamMember?.id) {
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .update({
          jersey_number: form.jersey_number
            ? Number(form.jersey_number)
            : null,
          position: form.position || null,
        })
        .eq('id', teamMember.id)

      if (teamMemberError) {
        console.error(
          'Error saving team information:',
          teamMemberError
        )

        alert(
          'Profile saved, but team information could not be saved.'
        )

        setSaving(false)
        return
      }
    }

    if (form.industry_id) {
      const { error: businessError } = await supabase
        .from('profile_business_listings')
        .upsert(
          {
            profile_id: profile.id,
            industry_id: form.industry_id,
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

    const { error: subPreferencesError } =
      await saveSubTeamPreferences()

    if (subPreferencesError) {
      alert(
        'Profile saved, but sub-team selections could not be saved.'
      )

      setSaving(false)
      return
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

              <input
                type="text"
                value={form.position}
                onChange={(event) =>
                  updateField(
                    'position',
                    event.target.value
                  )
                }
                placeholder="Forward, Defense, or Goalie"
              />
            </label>
          </div>
        </section>

        <section className="content-card profile-card sub-availability-card">
          <header className="content-card-header">
            <div>
              <h2>Sub Availability</h2>

              <p className="sub-availability-description">
                Select the teams this player is willing to
                substitute for.
              </p>
            </div>
          </header>

          {subPreferencesLoading ? (
            <p>Loading teams...</p>
          ) : teams.length === 0 ? (
            <p>No teams are currently available.</p>
          ) : (
            <div className="sub-team-options">
              {teams.map((team) => (
                <label
                  className="sub-team-option"
                  key={team.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedSubTeamIds.includes(team.id)}
                    onChange={() =>
                      toggleSubTeam(team.id)
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

              <select
                value={form.industry_id}
                onChange={(event) =>
                  updateField(
                    'industry_id',
                    event.target.value
                  )
                }
              >
                <option value="">
                  No industry selected
                </option>

                {industries.map((industry) => (
                  <option
                    key={industry.id}
                    value={industry.id}
                  >
                    {industry.name}
                  </option>
                ))}
              </select>
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

      <div className="profile-actions">
        <button
          type="button"
          className="action-btn action-btn--primary"
          onClick={handleSave}
          disabled={saving || subPreferencesLoading}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}