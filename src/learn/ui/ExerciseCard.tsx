import { Show } from 'solid-js'
import { t } from '../../i18n'
import type { ExerciseCategory, ExerciseDifficulty } from '../core/Exercise'
import styles from './ExerciseCard.module.css'

export interface ExerciseCardDescriptorLike {
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  title: string
  blurb: string
}

export interface CardOptions {
  descriptor: ExerciseCardDescriptorLike
  icon?: string
  onLaunch: (descriptor: ExerciseCardDescriptorLike) => void
}

export function ExerciseCardView(props: CardOptions) {
  return (
    <button
      type="button"
      class={styles.exCard}
      data-category={props.descriptor.category}
      data-difficulty={props.descriptor.difficulty}
      onClick={() => props.onLaunch(props.descriptor)}
    >
      <Show when={props.icon}>
        {(icon) => <span class={styles.exCardIcon} aria-hidden="true" innerHTML={icon()} />}
      </Show>
      <span class={styles.exCardTitle}>{props.descriptor.title}</span>
      <span class={styles.exCardBlurb}>{props.descriptor.blurb}</span>
    </button>
  )
}

export interface ComingSoonProps {
  category: string
  label: string
  icon?: string
}

export function ComingSoonCardView(props: ComingSoonProps) {
  return (
    <div class={`${styles.exCard} ${styles.exCardComing}`} data-category={props.category}>
      <Show when={props.icon}>
        {(icon) => <span class={styles.exCardIcon} aria-hidden="true" innerHTML={icon()} />}
      </Show>
      <span class={styles.exCardTitle}>{props.label}</span>
      <span class={styles.exCardBlurb}>{t('learn.hub.comingSoon')}</span>
    </div>
  )
}
