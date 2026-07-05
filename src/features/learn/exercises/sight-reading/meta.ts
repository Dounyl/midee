import { t } from '../../../i18n'
import type { ExerciseMetadata } from '../../core/Exercise'

export const sightReadingMeta = {
  id: 'sight-reading',
  get title() {
    return t('learn.exercise.sightReading.title')
  },
  category: 'sight-reading',
  difficulty: 'beginner',
  get blurb() {
    return t('learn.exercise.sightReading.blurb')
  },
  capabilities: {
    requiresLoadedMidi: false,
    usesOverlay: false,
    usesInputBus: true,
    supportsMidiReplacement: false,
  },
} satisfies ExerciseMetadata
