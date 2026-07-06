import { describe, expect, it } from 'vitest'
import {
  isLegacyRouteTargetPath,
  modeToRouteTarget,
  pathToRouteTarget,
  routeTargetToMode,
  routeTargetToPath,
} from './routeTarget'

describe('routeTarget', () => {
  it('round-trips canonical learn targets', () => {
    const targets = [
      { kind: 'learn-hub' } as const,
      { kind: 'exercise', routeId: 'play-along' } as const,
      { kind: 'exercise', routeId: 'intervals' } as const,
      { kind: 'exercise', routeId: 'sight-reading' } as const,
    ]

    for (const target of targets) {
      const path = routeTargetToPath(target)
      expect(pathToRouteTarget(path)).toEqual(target)
      expect(routeTargetToPath(pathToRouteTarget(path)!)).toBe(path)
    }
  })

  it('maps modes to canonical route targets', () => {
    expect(modeToRouteTarget('home')).toEqual({ kind: 'home' })
    expect(modeToRouteTarget('play')).toEqual({ kind: 'play' })
    expect(modeToRouteTarget('live')).toEqual({ kind: 'live' })
    expect(modeToRouteTarget('learn')).toEqual({ kind: 'learn-hub' })
  })

  it('maps route targets back to modes', () => {
    expect(routeTargetToMode({ kind: 'home' })).toBe('home')
    expect(routeTargetToMode({ kind: 'play' })).toBe('play')
    expect(routeTargetToMode({ kind: 'live' })).toBe('live')
    expect(routeTargetToMode({ kind: 'learn-hub' })).toBe('learn')
    expect(routeTargetToMode({ kind: 'exercise', routeId: 'play-along' })).toBe('learn')
  })

  it('recognizes legacy learn paths as redirect-only aliases', () => {
    expect(pathToRouteTarget('/play-along')).toEqual({ kind: 'exercise', routeId: 'play-along' })
    expect(pathToRouteTarget('/ear-training/intervals')).toEqual({
      kind: 'exercise',
      routeId: 'intervals',
    })
    expect(isLegacyRouteTargetPath('/play-along')).toBe(true)
    expect(isLegacyRouteTargetPath('/learn/play-along')).toBe(false)
  })
})
