import { onCleanup, Show } from 'solid-js'
import { t } from '../../i18n'
import { trackEvent } from '../../telemetry'
import type { ExerciseResult } from '../core/Result'
import { createMountHandle } from './mountComponent'
import styles from './SessionSummary.module.css'

export interface SessionSummaryOptions {
  onAgain: () => void
  onNext: () => void
  // Auto-fade delay in ms. 0 disables auto-fade (user has to click). Default
  // 4000 matches the v2 plan.
  autoFadeMs?: number
}

interface ViewProps extends SessionSummaryOptions {
  result: ExerciseResult
  streakExtended: boolean
  xpGained: number
  onDismiss: () => void
}

function SessionSummaryView(props: ViewProps) {
  const accuracyPct = Math.round(props.result.accuracy * 100)
  const fade = props.autoFadeMs ?? 4000
  if (fade > 0) {
    // onCleanup fires when the caller disposes the Solid root (via dismiss()).
    // That covers both the auto-fade and user-triggered paths cleanly. The
    // timer only fires on true no-action auto-fade — a button click disposes
    // the root first, clearing it via onCleanup — so this won't double-count.
    const timer = setTimeout(() => {
      trackEvent('exercise_summary_action', {
        exercise_id: props.result.exerciseId,
        action: 'dismissed',
      })
      props.onDismiss()
    }, fade)
    onCleanup(() => clearTimeout(timer))
  }
  return (
    <div class={styles.sessionSummary} role="status">
      <div class={styles.sessionSummaryRow}>
        <div class={styles.sessionSummaryMetric}>
          <span class={styles.sessionSummaryValue}>{accuracyPct}%</span>
          <span class={styles.sessionSummaryLabel}>{t('learn.summary.accuracy')}</span>
        </div>
        <div class={styles.sessionSummaryMetric}>
          <span class={styles.sessionSummaryValue}>+{props.xpGained}</span>
          <span class={styles.sessionSummaryLabel}>{t('learn.summary.xp')}</span>
        </div>
        <Show when={props.streakExtended}>
          <div class={`${styles.sessionSummaryMetric} ${styles.sessionSummaryMetricStreak}`}>
            <span class={styles.sessionSummaryValue}>{t('learn.summary.streakBump')}</span>
          </div>
        </Show>
        <div class={styles.sessionSummaryActions}>
          <button
            class={styles.sessionSummaryBtn}
            type="button"
            onClick={() => {
              trackEvent('exercise_summary_action', {
                exercise_id: props.result.exerciseId,
                action: 'again',
              })
              props.onDismiss()
              props.onAgain()
            }}
          >
            {t('learn.summary.again')}
          </button>
          <button
            class={`${styles.sessionSummaryBtn} ${styles.sessionSummaryBtnPrimary}`}
            type="button"
            onClick={() => {
              trackEvent('exercise_summary_action', {
                exercise_id: props.result.exerciseId,
                action: 'next',
              })
              props.onDismiss()
              props.onNext()
            }}
          >
            {t('learn.summary.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function createSessionSummary(opts: SessionSummaryOptions) {
  const handle = createMountHandle(SessionSummaryView)
  const autoFadeMs = opts.autoFadeMs

  return {
    show(
      host: HTMLElement,
      result: ExerciseResult,
      extras: { streakExtended: boolean; xpGained: number },
    ): void {
      handle.mount(host, {
        onAgain: opts.onAgain,
        onNext: opts.onNext,
        ...(autoFadeMs !== undefined ? { autoFadeMs } : {}),
        result,
        streakExtended: extras.streakExtended,
        xpGained: extras.xpGained,
        onDismiss: () => handle.unmount(),
      })
    },
    dismiss(): void {
      handle.unmount()
    },
  }
}
