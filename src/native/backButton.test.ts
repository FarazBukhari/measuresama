import { describe, expect, it } from 'vitest'
import { decideBackAction } from './backButton'

describe('decideBackAction', () => {
  it('closes an open overlay first', () => {
    expect(decideBackAction(true, '/tip-calculator', true)).toBe('close-overlay')
  })
  it('goes back through the history on inner pages', () => {
    expect(decideBackAction(false, '/tip-calculator', true)).toBe('back')
  })
  it('goes home when an inner page was opened directly', () => {
    expect(decideBackAction(false, '/settings', false)).toBe('home')
  })
  it('leaves the app from the home page', () => {
    expect(decideBackAction(false, '/', true)).toBe('exit')
  })
})
