import type { LucideIcon } from 'lucide-react'
import { Box, Camera, FileText, MoveVertical, Ruler, Spline, SquareDashed, Triangle, MoveHorizontal } from 'lucide-react'

export type ModeStatus = 'available' | 'coming-soon'

export interface ModeInfo {
  id: string
  name: string
  description: string
  status: ModeStatus
  icon: LucideIcon
  /** Route of an available mode. Coming-soon modes have none and never call the AR plugin. */
  path?: string
  /** Uses the camera (AR) rather than the screen. */
  camera: boolean
}

/** Every measuring mode, in roadmap order. */
export const MODES: readonly ModeInfo[] = [
  {
    id: 'distance',
    name: 'Distance',
    description: 'Point your phone at two spots and get the length between them.',
    status: 'available',
    icon: MoveHorizontal,
    path: '/ar',
    camera: true,
  },
  {
    id: 'screen-ruler',
    name: 'On-screen ruler',
    description: 'A real-size ruler on your screen for small things like screws and cards.',
    status: 'available',
    icon: Ruler,
    path: '/ruler',
    camera: false,
  },
  { id: 'height', name: 'Height', description: 'How tall something is, from the floor up.', status: 'available', icon: MoveVertical, path: '/ar/height', camera: true },
  { id: 'angle', name: 'Angle', description: 'The angle between two edges or walls.', status: 'available', icon: Triangle, path: '/ar/angle', camera: true },
  { id: 'path', name: 'Path', description: 'Add up a line with several turns, like a skirting board.', status: 'available', icon: Spline, path: '/ar/path', camera: true },
  { id: 'area', name: 'Area & perimeter', description: 'Floor or wall area, and the length around it.', status: 'available', icon: SquareDashed, path: '/ar/area', camera: true },
  { id: 'volume', name: 'Volume', description: 'How much a box or room holds.', status: 'available', icon: Box, path: '/ar/volume', camera: true },
  { id: 'room-plan', name: 'Room plan + PDF', description: 'Walk around a room to draw its plan and save it as a PDF.', status: 'available', icon: FileText, path: '/ar/room-plan', camera: true },
  { id: 'photo', name: 'Photo measure', description: 'Measure in a photo, using a bank card for scale.', status: 'available', icon: Camera, path: '/photo', camera: false },
]

export const availableModes = () => MODES.filter((m) => m.status === 'available')
export const comingSoonModes = () => MODES.filter((m) => m.status === 'coming-soon')
