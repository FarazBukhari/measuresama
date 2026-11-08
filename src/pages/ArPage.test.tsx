import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArAvailability, ArStartResult } from '../plugins/ar-measure/definitions'

const plugin = vi.hoisted(() => ({
  checkArAvailability: vi.fn<() => Promise<ArAvailability>>(),
  requestArInstall: vi.fn<() => Promise<string>>(),
  start: vi.fn<(o: { mode: string; unit: string }) => Promise<ArStartResult>>(),
}))

vi.mock('../plugins/ar-measure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../plugins/ar-measure')>()
  return {
    ...actual,
    checkArAvailability: plugin.checkArAvailability,
    requestArInstall: plugin.requestArInstall,
    ArMeasure: { start: plugin.start, checkAvailability: vi.fn(), requestInstall: vi.fn() },
  }
})

const { default: ArPage, PERMISSION_MESSAGE } = await import('./ArPage')
const { historyStore } = await import('../state/history')
const { setUnit } = await import('../state/settings')

function Detail() {
  const { id } = useParams()
  return <p>Detail {id}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ar']}>
      <Routes>
        <Route path="/ar" element={<ArPage />} />
        <Route path="/ruler" element={<p>Ruler page</p>} />
        <Route path="/history/:id" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const supported: ArAvailability = { status: 'supported', platform: 'android' }

beforeEach(() => {
  setUnit('cm')
  historyStore.set([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AR distance page', () => {
  it('checks the phone first and never starts or installs by itself', async () => {
    plugin.checkArAvailability.mockResolvedValue(supported)
    renderPage()
    expect(screen.getByText('Checking your phone…')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Start measuring' })).toBeEnabled()
    expect(plugin.start).not.toHaveBeenCalled()
    expect(plugin.requestArInstall).not.toHaveBeenCalled()
    expect(screen.queryByTestId('ar-fallback')).toBeNull()
  })

  it('saves a measurement and opens it', async () => {
    plugin.checkArAvailability.mockResolvedValue(supported)
    plugin.start.mockResolvedValue({
      cancelled: false,
      mode: 'distance',
      unit: 'cm',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1.5 },
      ],
      distanceM: 1.5,
      createdAt: '2026-11-06T12:00:00Z',
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Start measuring' }))
    expect(plugin.start).toHaveBeenCalledWith({ mode: 'distance', unit: 'cm' })
    const [item] = historyStore.get()
    expect(item).toMatchObject({ distanceM: 1.5, mode: 'distance' })
    expect(await screen.findByText(`Detail ${item.id}`)).toBeInTheDocument()
  })

  it.each([
    [{ cancelled: true, reason: 'permission-denied' } as const, PERMISSION_MESSAGE],
    [{ cancelled: true, reason: 'ar-unavailable', message: 'The camera is busy.' } as const, 'The camera is busy.'],
  ])('explains a cancelled session (%o)', async (result, text) => {
    plugin.checkArAvailability.mockResolvedValue(supported)
    plugin.start.mockResolvedValue(result)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Start measuring' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(historyStore.get()).toEqual([])
  })

  it('stays put quietly when the user closes the camera', async () => {
    plugin.checkArAvailability.mockResolvedValue(supported)
    plugin.start.mockResolvedValue({ cancelled: true, reason: 'user' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Start measuring' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start measuring' })).toBeEnabled())
    expect(screen.queryByRole('status', { name: /./ })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a friendly message when start is rejected', async () => {
    plugin.checkArAvailability.mockResolvedValue(supported)
    plugin.start.mockRejectedValue(Object.assign(new Error('nope'), { code: 'NOT_IMPLEMENTED' }))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Start measuring' }))
    expect(await screen.findByText('This mode is coming soon.')).toBeInTheDocument()
  })

  it('offers the Google app when it is missing, and checks again after installing', async () => {
    plugin.checkArAvailability.mockResolvedValueOnce({ status: 'needs-install', platform: 'android' }).mockResolvedValueOnce(supported)
    plugin.requestArInstall.mockResolvedValue('supported')
    renderPage()
    const fallback = await screen.findByTestId('ar-fallback')
    expect(fallback).toHaveTextContent('One free app needed')
    expect(screen.getByRole('button', { name: 'Use the on-screen ruler' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Install it' }))
    expect(plugin.requestArInstall).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Start measuring' })).toBeInTheDocument()
    expect(plugin.checkArAvailability).toHaveBeenCalledTimes(2)
  })

  it('lets the user try again when the check was inconclusive, or use the ruler', async () => {
    plugin.checkArAvailability.mockResolvedValue({ status: 'unknown', platform: 'android' })
    renderPage()
    const fallback = await screen.findByTestId('ar-fallback')
    expect(fallback).toHaveTextContent('Couldn’t check this phone')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('ar-fallback')
    expect(plugin.checkArAvailability).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Install it' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Use the on-screen ruler' }))
    expect(await screen.findByText('Ruler page')).toBeInTheDocument()
  })
})
