import { classifyArticulation } from './scoring'

export interface PerformanceCounters {
  perfect: number
  good: number
  errors: number
  heldTicks: number
  streak: number
  cleanPasses: number
}

export function applyPerformanceAdvance(
  counters: PerformanceCounters,
  articulationMs: number,
): Pick<PerformanceCounters, 'perfect' | 'good' | 'streak'> {
  const verdict = classifyArticulation(articulationMs)
  if (verdict === 'perfect') {
    return {
      perfect: counters.perfect + 1,
      good: counters.good,
      streak: counters.streak + 1,
    }
  }
  return {
    perfect: counters.perfect,
    good: counters.good + 1,
    streak: counters.streak + 1,
  }
}

export function applyPerformanceReject(
  counters: PerformanceCounters,
): Pick<PerformanceCounters, 'errors' | 'streak' | 'cleanPasses'> {
  return {
    errors: counters.errors + 1,
    streak: 0,
    cleanPasses: 0,
  }
}

export function applyHeldTickBonus(
  counters: PerformanceCounters,
  heldCount: number,
): Pick<PerformanceCounters, 'heldTicks'> {
  return {
    heldTicks: counters.heldTicks + Math.max(0, heldCount),
  }
}
