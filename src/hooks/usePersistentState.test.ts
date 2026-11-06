import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePersistentState } from './usePersistentState'

describe('usePersistentState', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistentState('test:a', 5))
    expect(result.current[0]).toBe(5)
  })

  it('persists updates and restores them on the next mount', () => {
    const first = renderHook(() => usePersistentState('test:b', 'x'))
    act(() => first.result.current[1]('y'))
    first.unmount()
    const second = renderHook(() => usePersistentState('test:b', 'x'))
    expect(second.result.current[0]).toBe('y')
  })

  it('restores an emptied number field as NaN instead of 0', () => {
    const first = renderHook(() => usePersistentState('test:c', 10))
    act(() => first.result.current[1](Number.NaN))
    first.unmount()
    const second = renderHook(() => usePersistentState('test:c', 10))
    expect(second.result.current[0]).toBeNaN()
  })
})
