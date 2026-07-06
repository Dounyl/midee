import type { ExerciseMetadata } from '@/features/learn/core/Exercise'
import { t } from '@/i18n'

export const intervalsMeta = {
  id: 'intervals',
  get title() {
    return t('learn.exercise.intervals.title')
  },
  category: 'ear-training',
  difficulty: 'beginner',
  get blurb() {
    return t('learn.exercise.intervals.blurb')
  },
  capabilities: {
    requiresLoadedMidi: false,
    usesOverlay: true,
    usesInputBus: false,
    supportsMidiReplacement: false,
  },
} satisfies ExerciseMetadata
