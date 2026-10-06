import { useCallback, useEffect, useState } from 'react'
import { describe } from './api'

/** Small data hook: load on mount / when deps change, expose reload. */
export function useFetch<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await run())
      setError(null)
    } catch (e) {
      setError(describe(e))
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => { reload() }, [reload])
  return { data, setData, error, loading, reload }
}
