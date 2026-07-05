import type {
  Exercise,
  ExerciseCapabilities,
  ExerciseCategory,
  ExerciseDescriptor,
  ExerciseDifficulty,
} from './Exercise'
import type { ExerciseContext } from './ExerciseContext'

export interface ExerciseDescriptorOptions {
  id: string
  title: string | (() => string)
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  blurb: string | (() => string)
  capabilities: ExerciseCapabilities
  factory: (ctx: ExerciseContext) => Exercise
  preload?: () => Promise<void>
}

export function defineExerciseDescriptor(options: ExerciseDescriptorOptions): ExerciseDescriptor {
  const descriptor: ExerciseDescriptor = {
    id: options.id,
    get title() {
      return typeof options.title === 'function' ? options.title() : options.title
    },
    category: options.category,
    difficulty: options.difficulty,
    get blurb() {
      return typeof options.blurb === 'function' ? options.blurb() : options.blurb
    },
    capabilities: options.capabilities,
    factory: options.factory,
  }
  if (options.preload) {
    descriptor.preload = options.preload
  }
  return descriptor
}
