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
  { id: 'height', name: 'Height', description: 'How tall something is, from the floor up.', status: 'coming-soon', icon: MoveVertical, camera: true },
  { id: 'angle', name: 'Angle', description: 'The angle between two edges or walls.', status: 'coming-soon', icon: Triangle, camera: true },
  { id: 'path', name: 'Path', description: 'Add up a line with several turns, like a skirting board.', status: 'coming-soon', icon: Spline, camera: true },
  { id: 'area', name: 'Area & perimeter', description: 'Floor or wall area, and the length around it.', status: 'coming-soon', icon: SquareDashed, camera: true },
  { id: 'volume', name: 'Volume', description: 'How much a box or room holds.', status: 'coming-soon', icon: Box, camera: true },
  { id: 'room-plan', name: 'Room plan + PDF', description: 'Walk around a room to draw its plan and save it as a PDF.', status: 'coming-soon', icon: FileText, camera: true },
  { id: 'photo', name: 'Photo measure', description: 'Measure in a photo using a bank card or sheet of paper for scale.', status: 'coming-soon', icon: Camera, camera: false },
]

export const availableModes = () => MODES.filter((m) => m.status === 'available')
export const comingSoonModes = () => MODES.filter((m) => m.status === 'coming-soon')
