import { describe, expect, it } from 'vitest'
import { resolveInitialRoutePath } from './modeRoutes'

describe('modeRoutes', () => {
  it('keeps explicit deep links', () => {
    expect(resolveInitialRoutePath('/learn')).toBe('/learn')
    expect(resolveInitialRoutePath('/play')).toBe('/play')
    expect(resolveInitialRoutePath('/learn/play-along')).toBe('/learn/play-along')
  })

  it('canonicalizes legacy learn deep links to /learn/... paths', () => {
    expect(resolveInitialRoutePath('/play-along')).toBe('/learn/play-along')
    expect(resolveInitialRoutePath('/ear-training/intervals')).toBe('/learn/intervals')
    expect(resolveInitialRoutePath('/sight-reading')).toBe('/learn/sight-reading')
  })

  it('redirects the home route to play', () => {
    expect(resolveInitialRoutePath('/')).toBe('/play')
  })

  it('falls back unknown routes to play', () => {
    expect(resolveInitialRoutePath('/unknown')).toBe('/play')
  })
})
