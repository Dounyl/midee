import type {
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseMetadata,
} from '@/features/learn/core/Exercise'
import { intervalsMeta } from '@/features/learn/exercises/intervals/meta'
import { playAlongMeta } from '@/features/learn/exercises/play-along/meta'
import { sightReadingMeta } from '@/features/learn/exercises/sight-reading/meta'
import { type ExerciseRouteId, exerciseRouteToPath } from '@/features/routing/learnRoutes'

export interface LearnRouteEntry {
  id: ExerciseMetadata['id']
  title: ExerciseMetadata['title']
  blurb: ExerciseMetadata['blurb']
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  route: string
  requiresLoadedMidi: boolean
}

function asRouteEntry(descriptor: ExerciseMetadata, route: ExerciseRouteId): LearnRouteEntry {
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
    route: exerciseRouteToPath(route),
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
