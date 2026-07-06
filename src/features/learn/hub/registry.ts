import type { ExerciseDescriptor } from '@/features/learn/core/Exercise'
import { intervalsDescriptor } from '../exercises/intervals'
import { playAlongDescriptor } from '../exercises/play-along'
import { sightReadingDescriptor } from '../exercises/sight-reading'

export const CATALOG: ExerciseDescriptor[] = [
  playAlongDescriptor,
  intervalsDescriptor,
  sightReadingDescriptor,
]

export function findExercise(id: string): ExerciseDescriptor | undefined {
  return CATALOG.find((descriptor) => descriptor.id === id)
}
