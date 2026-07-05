import { t } from '../../../i18n'
import type { ExerciseMetadata } from '../../core/Exercise'

export const playAlongMeta = {
  id: 'play-along',
  get title() {
    return t('learn.exercise.playAlong.title')
  },
  category: 'play-along',
  difficulty: 'beginner',
  get blurb() {
    return t('learn.exercise.playAlong.blurb')
  },
  capabilities: {
    requiresLoadedMidi: true,
    usesOverlay: true,
    usesInputBus: true,
    supportsMidiReplacement: true,
  },
} satisfies ExerciseMetadata
