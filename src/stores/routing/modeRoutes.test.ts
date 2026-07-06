import { describe, expect, it } from 'vitest'
import { resolveInitialRoutePath } from './modeRoutes'

describe('modeRoutes', () => {
  it('keeps explicit deep links even when skip-home is enabled', () => {
    expect(resolveInitialRoutePath('/learn', true)).toBe('/learn')
    expect(resolveInitialRoutePath('/play', true)).toBe('/play')
    expect(resolveInitialRoutePath('/learn/play-along', true)).toBe('/learn/play-along')
  })

  it('canonicalizes legacy learn deep links to /learn/... paths', () => {
    expect(resolveInitialRoutePath('/play-along', true)).toBe('/learn/play-along')
    expect(resolveInitialRoutePath('/ear-training/intervals', true)).toBe('/learn/intervals')
    expect(resolveInitialRoutePath('/sight-reading', false)).toBe('/learn/sight-reading')
  })

  it('redirects the home route to play when skip-home is enabled', () => {
    expect(resolveInitialRoutePath('/', true)).toBe('/play')
  })

  it('falls back unknown routes to the preferred landing path', () => {
    expect(resolveInitialRoutePath('/unknown', true)).toBe('/play')
    expect(resolveInitialRoutePath('/unknown', false)).toBe('/')
  })
})
