import { describe, expect, it } from 'vitest'
import { modeToPath, pathToMode, resolveInitialRoutePath } from './modeRoutes'

describe('modeRoutes', () => {
  it('maps modes to paths', () => {
    expect(modeToPath('home')).toBe('/')
    expect(modeToPath('play')).toBe('/play')
    expect(modeToPath('learn')).toBe('/learn')
    expect(modeToPath('live')).toBe('/live')
  })

  it('maps known paths back to modes', () => {
    expect(pathToMode('/')).toBe('home')
    expect(pathToMode('/play')).toBe('play')
    expect(pathToMode('/learn')).toBe('learn')
    expect(pathToMode('/live')).toBe('live')
    expect(pathToMode('/play/')).toBe('play')
  })

  it('keeps explicit deep links even when skip-home is enabled', () => {
    expect(resolveInitialRoutePath('/learn', true)).toBe('/learn')
    expect(resolveInitialRoutePath('/play', true)).toBe('/play')
  })

  it('redirects the home route to play when skip-home is enabled', () => {
    expect(resolveInitialRoutePath('/', true)).toBe('/play')
  })

  it('falls back unknown routes to the preferred landing path', () => {
    expect(resolveInitialRoutePath('/unknown', true)).toBe('/play')
    expect(resolveInitialRoutePath('/unknown', false)).toBe('/')
  })
})
