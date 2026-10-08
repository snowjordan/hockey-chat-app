import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function businessFor(listing) {
  return Array.isArray(listing.profile_business_listings)
    ? listing.profile_business_listings[0]
    : listing.profile_business_listings
}

function industryFor(business) {
  return business?.custom_industry?.trim() || business?.industries?.name?.trim() || ''
}

export default function Directory() {
  const [directoryListings, setDirectoryListings] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [industry, setIndustry] = useState('')
  const [availability, setAvailability] = useState('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function loadDirectoryListings() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        profile_business_listings (
          custom_industry,
          company_name,
          description,
          linkedin_url,
          website_url,
          is_available_for_work,
          industries (
            name
          )
        )
      `)
      .eq('is_system_account', false)
      .order('full_name')

    if (error) {
      setLoadError('Could not load the directory. Please try again.')
      setLoading(false)
      console.error(error)
      return
    }

    setDirectoryListings(data ?? [])
    setLoadError('')
    setLoading(false)
  }

  useEffect(() => {
    async function load() {
      await loadDirectoryListings()
    }
    load()
  }, [])

  const industries = [...new Set(directoryListings.map((listing) => industryFor(businessFor(listing))).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
  const hasFilters = Boolean(searchTerm || industry || availability !== 'all' || profileFilter !== 'all')

  function clearFilters() {
    setSearchTerm('')
    setIndustry('')
    setAvailability('all')
    setProfileFilter('all')
  }

  const filteredListings = directoryListings.filter((listing) => {
    const business = businessFor(listing)
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch = !search || [listing.full_name, listing.email, listing.phone,
      business?.company_name, industryFor(business), business?.description]
      .some((value) => value?.toLowerCase().includes(search))

    return matchesSearch
      && (!industry || industryFor(business) === industry)
      && (availability === 'all' || business?.is_available_for_work === true)
      && (profileFilter === 'all' || (profileFilter === 'with' ? Boolean(business) : !business))
  })

  return (
    <div className="page-view directory-view">
      <header className="page-header">
        <h2>Directory</h2>
        <p className="page-subtitle">
          Search league members by name, company, industry, or service.
        </p>
      </header>

      <section className="content-card">
        <div className="directory-search form-field">
          <label htmlFor="directory-search">Search directory</label>

          <input
            id="directory-search"
            type="search"
            placeholder="Search by name, company, industry, or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="directory-filters" role="group" aria-label="Directory filters">
          <div className="form-field">
            <label htmlFor="directory-industry">Industry</label>
            <select id="directory-industry" value={industry} onChange={(event) => setIndustry(event.target.value)}>
              <option value="">All industries</option>
              {industries.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="directory-availability">Work availability</label>
            <select id="directory-availability" value={availability} onChange={(event) => setAvailability(event.target.value)}>
              <option value="all">All members</option>
              <option value="available">Available for work</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="directory-profile">Business profile</label>
            <select id="directory-profile" value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)}>
              <option value="all">All members</option>
              <option value="with">With a business profile</option>
              <option value="without">Without a business profile</option>
            </select>
          </div>
        </div>
        <div className="directory-results-header">
          <p className="content-card-meta" role="status">{loading ? 'Loading directory...' : loadError ? 'Directory unavailable'
            : `${filteredListings.length} of ${directoryListings.length} members`}</p>
          {hasFilters && <button type="button" className="action-btn action-btn--outline" onClick={clearFilters}>Clear filters</button>}
        </div>
        {loadError && <div className="directory-empty">
          <p className="admin-save-error" role="alert">{loadError}</p>
          <button type="button" className="action-btn action-btn--outline" disabled={loading}
            onClick={() => { setLoading(true); setLoadError(''); loadDirectoryListings() }}>Try again</button>
        </div>}
        {!loading && !loadError && filteredListings.length === 0 && <div className="directory-empty">
          <strong>{hasFilters ? 'No members match your filters' : 'No members in the directory yet'}</strong>
          <p>{hasFilters ? 'Try a different search or clear your filters to see all members.' : 'Member listings will appear here once they are added.'}</p>
        </div>}
        <div className="directory-grid">
          {filteredListings.map((listing) => {
            const business = businessFor(listing)

            return (
              <article key={listing.id} className="directory-card">
                <header className="directory-card-header">
                  <h3>{listing.full_name}</h3>

                  {business?.is_available_for_work && (
                    <span className="available-pill">Available</span>
                  )}
                </header>

                <section className="directory-info-grid">
                  <div className="directory-field">
                    <label>Company</label>

                    <div className="directory-value">
                      {business?.company_name ?? 'No company listed'}
                    </div>
                  </div>

                  <div className="directory-field">
                    <label>Industry</label>

                    <div className="directory-value">
                      {industryFor(business) || 'No industry listed'}
                    </div>
                  </div>
                </section>

                <section className="directory-business">
                  <div className="directory-business-header">
                    <label>Business Profile</label>
                  </div>

                  <p className="directory-description">
                    {business?.description ??
                      "This member hasn't added a business profile yet."}
                  </p>
                </section>

                <footer className="directory-contact">
                  <div className="directory-contact-row">
                    <span className="directory-contact-email">
                      <span aria-hidden="true">✉</span> 
                      <span>{listing.email}</span>
                    </span>
                    <span className="directory-contact-phone">
                      <span aria-hidden="true">📞</span>
                      <span>{listing.phone || "No phone listed"}</span>
                    </span>
                  </div>

                  {(business?.linkedin_url || business?.website_url) && (
                    <div className="directory-contact-row">
                      {business?.linkedin_url && (
                        <span className="directory-link-item">
                          <span aria-hidden="true">🔗</span>
                          <a
                            href={business.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            LinkedIn
                          </a>
                        </span>
                      )}

                      {business?.website_url && (
                        <span className="directory-link-item">
                          <span aria-hidden="true">🌐</span>
                          <a
                            href={business.website_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Website
                          </a>
                        </span>
                      )}
                    </div>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}