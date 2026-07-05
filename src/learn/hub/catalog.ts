import { type LearnRouteId, learnRouteToPath } from '../../routing/learnRoutes'
import type { ExerciseDescriptor } from '../core/Exercise'
import { intervalsDescriptor } from '../exercises/intervals'
import { playAlongDescriptor } from '../exercises/play-along'
import { sightReadingDescriptor } from '../exercises/sight-reading'

// Registry of every exercise the hub knows about. Exercises register here so
// the hub renders a card for them and the daily-drill planner can pick from
// the full set without hard-coding ids.
//
// Add a descriptor by importing it here and pushing it into `CATALOG`. The
// registration side-effect is intentional — it keeps the hub a thin view
// over this array and lets exercises live in self-contained folders.
export const CATALOG: ExerciseDescriptor[] = [
  playAlongDescriptor,
  intervalsDescriptor,
  sightReadingDescriptor,
]

export interface LearnRouteEntry {
  id: ExerciseDescriptor['id']
  title: ExerciseDescriptor['title']
  blurb: ExerciseDescriptor['blurb']
  category: ExerciseDescriptor['category']
  difficulty: ExerciseDescriptor['difficulty']
  route: string
  requiresLoadedMidi: boolean
}

function asRouteEntry(descriptor: ExerciseDescriptor, route: LearnRouteId): LearnRouteEntry {
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
  asRouteEntry(playAlongDescriptor, 'play-along'),
  asRouteEntry(intervalsDescriptor, 'intervals'),
  asRouteEntry(sightReadingDescriptor, 'sight-reading'),
]

export function findExercise(id: string): ExerciseDescriptor | undefined {
  return CATALOG.find((d) => d.id === id)
}

export function findLearnRoute(id: string): LearnRouteEntry | undefined {
  return LEARN_ROUTE_CATALOG.find((entry) => entry.id === id)
}
