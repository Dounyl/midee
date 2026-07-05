import { Show } from 'solid-js'
import { t } from '../../i18n'
import type { ExerciseCategory, ExerciseDifficulty } from '../core/Exercise'
import './ExerciseCard.css'

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
      class="ex-card"
      data-category={props.descriptor.category}
      data-difficulty={props.descriptor.difficulty}
      onClick={() => props.onLaunch(props.descriptor)}
    >
      <Show when={props.icon}>
        {(icon) => <span class="ex-card__icon" aria-hidden="true" innerHTML={icon()} />}
      </Show>
      <span class="ex-card__title">{props.descriptor.title}</span>
      <span class="ex-card__blurb">{props.descriptor.blurb}</span>
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
    <div class="ex-card ex-card--coming" data-category={props.category}>
      <Show when={props.icon}>
        {(icon) => <span class="ex-card__icon" aria-hidden="true" innerHTML={icon()} />}
      </Show>
      <span class="ex-card__title">{props.label}</span>
      <span class="ex-card__blurb">{t('learn.hub.comingSoon')}</span>
    </div>
  )
}
