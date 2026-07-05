import { describe, expect, it } from 'vitest'
import {
  applyHeldTickBonus,
  applyPerformanceAdvance,
  applyPerformanceReject,
  type PerformanceCounters,
} from './performanceScoring'

function counters(): PerformanceCounters {
  return {
    perfect: 0,
    good: 0,
    errors: 0,
    heldTicks: 0,
    streak: 0,
    cleanPasses: 2,
  }
}

describe('performanceScoring', () => {
  it('counts cohesive articulation as perfect and advances streak', () => {
    expect(applyPerformanceAdvance(counters(), 50)).toEqual({
      perfect: 1,
      good: 0,
      streak: 1,
    })
  })

  it('counts slower articulation as good and still advances streak', () => {
    expect(applyPerformanceAdvance(counters(), 180)).toEqual({
      perfect: 0,
      good: 1,
      streak: 1,
    })
  })

  it('wrong-pitch reject resets streak and clean passes', () => {
    expect(applyPerformanceReject(counters())).toEqual({
      errors: 1,
      streak: 0,
      cleanPasses: 0,
    })
  })

  it('held tick bonus accumulates held notes', () => {
    expect(applyHeldTickBonus(counters(), 3)).toEqual({ heldTicks: 3 })
  })

  it('held tick bonus ignores negative input', () => {
    expect(applyHeldTickBonus(counters(), -2)).toEqual({ heldTicks: 0 })
  })
})
