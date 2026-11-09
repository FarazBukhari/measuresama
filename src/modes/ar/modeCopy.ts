import { AR_PLUGIN_MODES, type ArPluginMode } from '../../plugins/ar-measure'

/** Words on an AR mode's start page. Keep them short: people skim, they don't read. */
export interface ModeCopy {
  /** The page's h1 and document title. */
  title: string
  /** One line under the title, 8 words at most. */
  intro: string
  /** Up to 3 steps of 6 words at most. */
  tips: string[]
}

export const AR_MODE_COPY: Record<ArPluginMode, ModeCopy> = {
  distance: {
    title: 'Measure a distance',
    intro: 'Two taps, one length.',
    tips: ['Scan the floor slowly', 'Tap + at one end', 'Tap + at the other end'],
  },
  height: {
    title: 'Measure height',
    intro: 'From the floor up.',
    tips: ['Tap + at the bottom', 'Tilt up to the top', 'Tap + at the top'],
  },
  angle: {
    title: 'Measure an angle',
    intro: 'Side, corner, side.',
    tips: ['Tap + on one edge', 'Tap + on the corner', 'Tap + on the other edge'],
  },
  path: {
    title: 'Measure a path',
    intro: 'A line with turns, added up.',
    tips: ['Tap + at the start', 'Tap + at every turn', 'Tap Save at the end'],
  },
  area: {
    title: 'Measure an area',
    intro: 'Tap each corner of the shape.',
    tips: ['Tap + on every corner', 'Go around in order', 'Tap Save when done'],
  },
  volume: {
    title: 'Measure volume',
    intro: 'Length, width, then height.',
    tips: ['Tap + on two floor corners', 'Tap + across the width', 'Tap + at the top'],
  },
  'room-plan': {
    title: 'Room plan',
    intro: 'Walk the room, corner by corner.',
    tips: ['Tap + on each floor corner', 'Go around the room', 'Tap Save for the plan'],
  },
}

/** True for an AR mode that has a start page at /ar/:mode. 'photo' is not one: it has its own page. */
export function isArPageMode(mode: string): mode is ArPluginMode {
  return (AR_PLUGIN_MODES as readonly string[]).includes(mode)
}
