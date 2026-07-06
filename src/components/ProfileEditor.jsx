import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ProfileEditor({ profile, onBack, onSaved }) {
  const [businessListingId, setBusinessListingId] = useState(null)
  const [industries, setIndustries] = useState([])
  const [saving, setSaving] = useState(false)
  const [teamMember, setTeamMember] = useState(null)

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    notes: profile?.notes ?? '',
    industry_id: '',
    company_name: '',
    description: '',
    is_available_for_work: true,
    linkedin_url: "",
    website_url: "",
    jersey_number: "",
    position: "",    
  });

  useEffect(() => {
    async function loadFormData() {
      const { data: industriesData, error: industriesError } = await supabase
        .from('industries')
        .select('id, name')
        .order('name')

      if (industriesError) {
        console.error(industriesError)
      } else {
        setIndustries(industriesData)
      }

      const { data: businessData, error: businessError } = await supabase
        .from('profile_business_listings')
        .select('id, industry_id, company_name, description, is_available_for_work, linkedin_url, website_url')
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (businessError) {
        console.error(businessError)
        return
      }

      if (businessData) {
        setBusinessListingId(businessData.id)
        setForm((current) => ({
          ...current,
          industry_id: businessData.industry_id ?? '',
          company_name: businessData.company_name ?? '',
          description: businessData.description ?? '',
          is_available_for_work: businessData.is_available_for_work ?? true,
          linkedin_url: businessData.linkedin_url ?? '',
          website_url: businessData.website_url ?? '',
        }))
      }
      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from('team_members')
        .select('id, team_id, jersey_number, position')
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (teamMemberError) {
        console.error(teamMemberError)
      } else if (teamMemberData) {
        setTeamMember(teamMemberData)
        setForm((current) => ({
          ...current,
          jersey_number: teamMemberData.jersey_number ?? '',
          position: teamMemberData.position ?? '',
        }))
      }
    }


    loadFormData()
  }, [profile.id])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function normalizeUrl(value) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return encodeURI(trimmed);
  }

  return encodeURI(`https://${trimmed}`);
}

  function decodeUrl(value) {
    return value ? decodeURI(value) : "";
  }

  async function handleSave() {
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      alert('Name, email, and phone are required.')
      return
    }

    console.log('profile', profile)
    console.log('teamMember', teamMember)
    setSaving(true)

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .single()

    if (profileError) {
      console.error(profileError)
      alert('Could not save profile.')
      setSaving(false)
      return
    }
    if (teamMember?.team_id) {
      const { error: teamMemberError} = await supabase
        .from("team_members")
        .update({
          jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
          position: form.position || null,
        })
        .eq('id', teamMember.id)

    
      if (teamMemberError) {
        console.error(teamMemberError)
        alert("Profile saved, but team information could not be saved.")
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
            company_name: form.company_name || null,
            description: form.description || null,
            is_available_for_work: form.is_available_for_work,
            linkedin_url: normalizeUrl(form.linkedin_url),
            website_url: normalizeUrl(form.website_url),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id' }
        )

      if (businessError) {
        console.error(businessError)
        alert('Profile saved, but business listing could not be saved.')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved?.(updatedProfile)
  }

  return (
    <div className="page-view player-detail-view">
      <button type="button" className="back-button" onClick={onBack}>
        ← Back to roster
      </button>

      <header className="page-header">
        <h2>Edit Profile</h2>
        <p className="page-subtitle">Required contact information for this player</p>
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
              onChange={(e) => updateField('full_name', e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Email *</span>
            <input
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Phone *</span>
            <input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
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
            Jersey Number
            <input
              type="number"
              value={form.jersey_number}
              onChange={(e) =>
                setForm({ ...form, jersey_number: e.target.value })
              }
              placeholder="11"
            />
          </label>

          <label className="form-field">
            Position
            <input
              type="text"
              value={form.position}
              onChange={(e) =>
                setForm({ ...form, position: e.target.value })
              }
              placeholder="Forward, Defense, Goalie"
            />
          </label>
        </div>
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
              onChange={(e) => updateField('industry_id', e.target.value)}
            >
              <option value="">No industry selected</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Company Name</span>
            <input
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.is_available_for_work}
              onChange={(e) => updateField('is_available_for_work', e.target.checked)}
            />
            Available for work
          </label>

          <label className="form-field">
            <span>LinkedIn URL</span>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value})
              }
              placeholder="https:///linkedin.com/in/name"
              />
          </label>

          <label className="form-field">
            <span>Company Website</span>
            <input
              type="url"
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value})
              }
              placeholder="https://company.com"
            />
          </label>

          <label className="form-field form-field--full">
            <span>Business Description</span>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="content-card profile-card">
        <header className="content-card-header">
          <h2>NOTES</h2>
        </header>

        <div className="profile-form-grid">
          <label className="form-field form-field--full">
            Optional notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Add anything else you want to remember about this player"
            />
          </label>
        </div>
      </section>
      </div>

      <div className="profile-actions">
        <button type="button" className="action-btn action-btn--primary" onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}