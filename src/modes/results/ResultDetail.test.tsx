import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryItem } from '../../state/history'

const pdf = vi.hoisted(() => ({ exportRoomPlanPdf: vi.fn(async () => ({ method: 'download' as const })) }))
vi.mock('../room-plan/pdf', () => pdf)

const { ResultDetail } = await import('./ResultDetail')
const { ResultSummary } = await import('./ResultSummary')

const base = { id: 'x', unit: 'cm' as const, createdAt: '2026-11-06T12:00:00.000Z' }
const DISTANCE: HistoryItem = { ...base, mode: 'distance', distanceM: 1.2345, points: [] }
const AREA: HistoryItem = { ...base, mode: 'area', areaM2: 2.5, perimeterM: 6.4, segmentsM: [2, 1.2, 2, 1.2], points: [] }
const ROOM: HistoryItem = {
  ...base,
  mode: 'room-plan',
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ],
  segmentsM: [4, 3, 4, 3],
  perimeterM: 14,
  areaM2: 12,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ResultDetail', () => {
  it('keeps the distance block as before', () => {
    render(<ResultDetail item={DISTANCE} unit="cm" />)
    expect(screen.getByTestId('length-main')).toHaveTextContent('1.23 m')
    expect(screen.getByTestId('length-other')).toHaveTextContent('4 ft 0.6 in')
    expect(screen.queryByTestId('result-main')).toBeNull()
    expect(screen.queryByTestId('result-secondary')).toBeNull()
  })

  it('shows the main value and the extras of other modes', () => {
    render(<ResultDetail item={AREA} unit="cm" />)
    expect(screen.getByText('Area')).toBeInTheDocument()
    expect(screen.getByTestId('result-main')).toHaveTextContent('2.50 m²')
    expect(screen.getByTestId('result-secondary')).toHaveTextContent('Perimeter6.40 m')
    expect(screen.queryByRole('img', { name: 'Room plan' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save PDF' })).toBeNull()
  })

  it('draws the room plan and saves it as a PDF', async () => {
    render(<ResultDetail item={ROOM} unit="cm" />)
    const plan = screen.getByRole('img', { name: 'Room plan' })
    expect(plan.querySelector('polygon')).not.toBeNull()
    expect(plan).toHaveTextContent('4.00 m')
    expect(plan).toHaveTextContent('3.00 m')
    expect(screen.getByTestId('result-main')).toHaveTextContent('12.00 m²')
    await userEvent.click(screen.getByRole('button', { name: 'Save PDF' }))
    expect(pdf.exportRoomPlanPdf).toHaveBeenCalledWith(ROOM, 'cm')
  })

  it('shows no plan for a room with too few corners', () => {
    render(<ResultDetail item={{ ...ROOM, points: ROOM.points.slice(0, 2) }} unit="cm" />)
    expect(screen.queryByRole('img', { name: 'Room plan' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save PDF' })).toBeInTheDocument()
  })
})

describe('ResultSummary', () => {
  it('shows the main value with the mode name', () => {
    render(<ResultSummary item={AREA} unit="in" />)
    expect(screen.getByText('26.91 sq ft')).toBeInTheDocument()
    expect(screen.getByText(/^Area & perimeter · /)).toBeInTheDocument()
  })
})
