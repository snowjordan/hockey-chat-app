import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Directory() {
  const [directoryListings, setDirectoryListings] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  async function loadDirectoryListings() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        profile_business_listings (
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
      .order('full_name')

    if (error) {
      console.error(error)
      return
    }

    setDirectoryListings(data)
  }

  useEffect(() => {
    loadDirectoryListings()
  }, [])

  const filteredListings = directoryListings.filter((listing) => {
    const business = Array.isArray(listing.profile_business_listings)
      ? listing.profile_business_listings[0]
      : listing.profile_business_listings

    const search = searchTerm.toLowerCase()

    return (
      listing.full_name?.toLowerCase().includes(search) ||
      listing.email?.toLowerCase().includes(search) ||
      listing.phone?.toLowerCase().includes(search) ||
      business?.company_name?.toLowerCase().includes(search) ||
      business?.industries?.name?.toLowerCase().includes(search) ||
      business?.description?.toLowerCase().includes(search)
    )
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
        <div className="directory-search">
          <label htmlFor="directory-search">Search directory</label>

          <input
            id="directory-search"
            type="text"
            placeholder="Search by name, company, industry, or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="directory-grid">
          {filteredListings.map((listing) => {
            const business = Array.isArray(listing.profile_business_listings)
              ? listing.profile_business_listings[0]
              : listing.profile_business_listings

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
                      {business?.industries?.name ?? 'No industry listed'}
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
                    <span>✉ {listing.email}</span>
                    <span>📞 {listing.phone || 'No phone listed'}</span>
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