import { createStore } from './createStore'

/**
 * Close callback of a full-screen overlay (e.g. the on-screen ruler or a dialog), so Android's
 * back button closes the overlay instead of leaving the page. Set while the overlay is open.
 */
export const overlayStore = createStore<(() => void) | null>(null)
