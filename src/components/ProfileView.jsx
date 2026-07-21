import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ProfileView({
  profile,
  currentProfile,
  onBack,
  onEdit,
}) {
  const [teamMemberships, setTeamMemberships] = useState([])
  const [subTeams, setSubTeams] = useState([])
  const [businessListing, setBusinessListing] = useState(null)
  const [loading, setLoading] = useState(true)

  const isOwnProfile =
    currentProfile?.id === profile?.id

  const isAdmin =
    currentProfile?.is_admin === true

  const canEdit = isOwnProfile || isAdmin

  useEffect(() => {
    async function loadProfileDetails() {
      if (!profile?.id) {
        return
      }

      setLoading(true)

      const [
        teamMembershipsResult,
        subPreferencesResult,
        businessResult,
      ] = await Promise.all([
        supabase
          .from('team_members')
          .select(`
            id,
            jersey_number,
            position,
            teams (
              id,
              name
            )
          `)
          .eq('profile_id', profile.id),

        supabase
          .from('sub_team_preferences')
          .select(`
            team_id,
            teams (
              id,
              name
            )
          `)
          .eq('profile_id', profile.id),

        supabase
          .from('profile_business_listings')
          .select(`
            id,
            company_name,
            description,
            is_available_for_work,
            linkedin_url,
            website_url,
            industries (
              id,
              name
            )
          `)
          .eq('profile_id', profile.id)
          .maybeSingle(),
      ])

      if (teamMembershipsResult.error) {
        console.error(
          'Error loading team memberships:',
          teamMembershipsResult.error
        )
      } else {
        setTeamMemberships(
          teamMembershipsResult.data ?? []
        )
      }

      if (subPreferencesResult.error) {
        console.error(
          'Error loading sub availability:',
          subPreferencesResult.error
        )
      } else {
        setSubTeams(
          subPreferencesResult.data ?? []
        )
      }

      if (businessResult.error) {
        console.error(
          'Error loading business listing:',
          businessResult.error
        )
      } else {
        setBusinessListing(
          businessResult.data ?? null
        )
      }

      setLoading(false)
    }

    loadProfileDetails()
  }, [profile?.id])

  if (!profile) {
    return null
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
        <div>
          <h2>{profile.full_name}</h2>

          <p className="page-subtitle">
            Player contact, team, and directory information.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={onEdit}
          >
            Edit Profile
          </button>
        )}
      </header>

      {loading ? (
        <p>Loading profile...</p>
      ) : (
        <div className="profile-sections-panel">
          <section className="content-card profile-card">
            <header className="content-card-header">
              <h2>Contact Information</h2>
            </header>

            <div className="profile-details-grid">
              <div className="profile-detail">
                <span className="profile-detail-label">
                  Name
                </span>

                <span>{profile.full_name || 'Not provided'}</span>
              </div>

              <div className="profile-detail">
                <span className="profile-detail-label">
                  Email
                </span>

                <span>{profile.email || 'Not provided'}</span>
              </div>

              <div className="profile-detail">
                <span className="profile-detail-label">
                  Phone
                </span>

                <span>{profile.phone || 'Not provided'}</span>
              </div>
            </div>
          </section>

          <section className="content-card profile-card">
            <header className="content-card-header">
              <h2>Team Information</h2>
            </header>

            {teamMemberships.length === 0 ? (
              <p>This player is not currently assigned to a team.</p>
            ) : (
              <div className="profile-list">
                {teamMemberships.map((membership) => (
                  <div
                    className="profile-list-item"
                    key={membership.id}
                  >
                    <strong>
                      {membership.teams?.name ?? 'Unknown team'}
                    </strong>

                    <span>
                      {membership.jersey_number
                        ? `#${membership.jersey_number}`
                        : 'No jersey number'}
                    </span>

                    <span>
                      {membership.position || 'No position listed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="content-card profile-card">
            <header className="content-card-header">
              <h2>Sub Availability</h2>
            </header>

            {subTeams.length === 0 ? (
              <p>
                This player has not selected any teams for
                substitute availability.
              </p>
            ) : (
              <div className="profile-tag-list">
                {subTeams.map((preference) => (
                  <span
                    className="profile-tag"
                    key={preference.team_id}
                  >
                    {preference.teams?.name ?? 'Unknown team'}
                  </span>
                ))}
              </div>
            )}
          </section>

          {businessListing && (
            <section className="content-card profile-card">
              <header className="content-card-header">
                <h2>Business Directory Listing</h2>
              </header>

              <div className="profile-details-grid">
                <div className="profile-detail">
                  <span className="profile-detail-label">
                    Company
                  </span>

                  <span>
                    {businessListing.company_name ||
                      'Not provided'}
                  </span>
                </div>

                <div className="profile-detail">
                  <span className="profile-detail-label">
                    Industry
                  </span>

                  <span>
                    {businessListing.industries?.name ||
                      'Not provided'}
                  </span>
                </div>

                <div className="profile-detail">
                  <span className="profile-detail-label">
                    Available for work
                  </span>

                  <span>
                    {businessListing.is_available_for_work
                      ? 'Yes'
                      : 'No'}
                  </span>
                </div>
              </div>

              {businessListing.description && (
                <div className="profile-detail profile-detail--full">
                  <span className="profile-detail-label">
                    Description
                  </span>

                  <p>{businessListing.description}</p>
                </div>
              )}

              <div className="profile-link-list">
                {businessListing.linkedin_url && (
                  <a
                    href={businessListing.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                  </a>
                )}

                {businessListing.website_url && (
                  <a
                    href={businessListing.website_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Company Website
                  </a>
                )}
              </div>
            </section>
          )}

          <section className="content-card profile-card">
            <header className="content-card-header">
              <h2>Notes</h2>
            </header>

            <p className="profile-notes">
              {profile.notes || 'No notes have been added.'}
            </p>
          </section>
        </div>
      )}
    </div>
  )
}