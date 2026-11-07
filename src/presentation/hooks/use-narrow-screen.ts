import { useSyncExternalStore } from 'react'

const NARROW_QUERY = '(max-width: 600px)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW_QUERY).matches)
}
