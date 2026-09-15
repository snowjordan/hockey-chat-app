import { useState } from 'react'

// Mount on first visit, then keep the same component tree and DOM alive.
// Hidden tabs retain loaded data, form drafts, filters, and nested views.
export default function SavedTab({ active, children }) {
  const [visited, setVisited] = useState(active)

  if (active && !visited) setVisited(true)
  if (!active && !visited) return null

  return (
    <div hidden={!active} style={{ display: active ? 'contents' : 'none' }}>
      {children()}
    </div>
  )
}
