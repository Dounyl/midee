import { type LearnRouteId, learnRouteToPath } from '../../routing/learnRoutes'
import type { ExerciseCategory, ExerciseDifficulty, ExerciseMetadata } from '../core/Exercise'
import { intervalsMeta } from '../exercises/intervals/meta'
import { playAlongMeta } from '../exercises/play-along/meta'
import { sightReadingMeta } from '../exercises/sight-reading/meta'

export interface LearnRouteEntry {
  id: ExerciseMetadata['id']
  title: ExerciseMetadata['title']
  blurb: ExerciseMetadata['blurb']
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  route: string
  requiresLoadedMidi: boolean
}

function asRouteEntry(descriptor: ExerciseMetadata, route: LearnRouteId): LearnRouteEntry {
  return {
    id: descriptor.id,
    get title() {
      return descriptor.title
    },
    get blurb() {
      return descriptor.blurb
    },
    category: descriptor.category,
    difficulty: descriptor.difficulty,
    route: learnRouteToPath(route),
    requiresLoadedMidi: descriptor.capabilities.requiresLoadedMidi,
  }
}

export const LEARN_ROUTE_CATALOG: LearnRouteEntry[] = [
  asRouteEntry(playAlongMeta, 'play-along'),
  asRouteEntry(intervalsMeta, 'intervals'),
  asRouteEntry(sightReadingMeta, 'sight-reading'),
]

export function findLearnRoute(id: string): LearnRouteEntry | undefined {
  return LEARN_ROUTE_CATALOG.find((entry) => entry.id === id)
}
