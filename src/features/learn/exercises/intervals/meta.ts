import { t } from '../../../i18n'
import type { ExerciseMetadata } from '../../core/Exercise'

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
