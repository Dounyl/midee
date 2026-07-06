import { describe, expect, it } from 'vitest'
import { isLegacyRouteTargetPath, pathToRouteTarget, routeTargetToPath } from './routeTarget'

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
