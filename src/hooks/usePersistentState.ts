import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { STORAGE_PREFIX, storage } from '../lib/storage'

/**
 * useState that survives reloads (stored in localStorage under `measuresama:<key>`).
 * Use a feature-scoped key, e.g. usePersistentState('ruler:unit', 'cm').
 */
export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const fullKey = STORAGE_PREFIX + key
  const [value, setValue] = useState<T>(() => {
    const stored = storage.get<T | null>(fullKey, initialValue)
    // JSON turns NaN (an emptied number field) into null; restore it as NaN, not 0.
    if (stored === null && typeof initialValue === 'number') return Number.NaN as T
    return stored as T
  })
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    storage.set(fullKey, value)
  }, [fullKey, value])

  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => setValue(next), [])
  return [value, set]
}
