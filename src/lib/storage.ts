/** Safe localStorage access — never throws (private mode, quota, disabled storage). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore quota / privacy errors */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  keys(prefix = ''): string[] {
    try {
      return Object.keys(localStorage).filter((k) => k.startsWith(prefix))
    } catch {
      return []
    }
  },
}

export const STORAGE_PREFIX = 'measuresama:'
