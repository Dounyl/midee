import type { ExerciseMetadata } from '@/features/learn/core/Exercise'
import { t } from '@/i18n'

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
