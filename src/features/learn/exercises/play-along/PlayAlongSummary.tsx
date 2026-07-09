import type { ExerciseResult, PlayAlongExerciseSummary } from '@/features/learn/core/Result'
import { createMountHandle } from '@/features/learn/ui/mountComponent'
import { t } from '@/i18n'
import { trackEvent } from '@/services/telemetry'
import styles from './PlayAlongSummary.module.css'

export interface PlayAlongSummaryOptions {
  onContinuePractice: () => void
  onCancel: () => void
}

interface ViewProps extends PlayAlongSummaryOptions {
  result: ExerciseResult
  summary: PlayAlongExerciseSummary
  xpGained: number
  streakExtended: boolean
  onDismiss: () => void
}

function PlayAlongSummaryView(props: ViewProps) {
  const accuracyPct = Math.round(props.result.accuracy * 100)
  const hits = props.summary.perfect + props.summary.good
  const isLoopSummary = props.summary.completionTarget === 'loop-end'
  const loopSeconds = props.summary.loopRegion
    ? (props.summary.loopRegion.end - props.summary.loopRegion.start).toFixed(1)
    : null
  const cancelSummary = () => {
    trackEvent('exercise_summary_action', {
      exercise_id: props.result.exerciseId,
      action: 'cancel',
    })
    props.onDismiss()
    props.onCancel()
  }

  return (
    <div class={styles.playAlongSummary}>
      <button
        type="button"
        class={styles.playAlongSummaryBackdrop}
        aria-label={t('learn.pa.summary.cancel')}
        onClick={cancelSummary}
      />
      <section
        class={styles.playAlongSummaryCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="play-along-summary-title"
      >
        <header class={styles.playAlongSummaryHeader}>
          <div>
            <p class={styles.playAlongSummaryEyebrow}>
              {isLoopSummary ? t('learn.pa.summary.loopTitle') : t('learn.pa.summary.songTitle')}
            </p>
            <h2 id="play-along-summary-title" class={styles.playAlongSummaryTitle}>
              {isLoopSummary && loopSeconds
                ? t('learn.pa.summary.loopSubtitle', { seconds: loopSeconds })
                : t('learn.pa.summary.songSubtitle')}
            </h2>
          </div>
          {props.streakExtended ? (
            <span class={styles.playAlongSummaryStreak}>{t('learn.summary.streakBump')}</span>
          ) : null}
        </header>

        <div class={styles.playAlongSummaryGrid}>
          <MetricCard
            value={`${accuracyPct}%`}
            label={t('learn.summary.accuracy')}
            accent="accent"
          />
          <MetricCard value={String(hits)} label={t('learn.pa.summary.hits')} />
          <MetricCard
            value={String(props.summary.errors)}
            label={t('learn.pa.summary.errors')}
            tone="danger"
          />
          <MetricCard
            value={String(props.summary.perfect)}
            label={t('learn.pa.summary.perfect')}
            tone="success"
          />
          <MetricCard value={String(props.summary.good)} label={t('learn.pa.summary.good')} />
          <MetricCard value={`+${props.xpGained}`} label={t('learn.summary.xp')} accent="accent" />
        </div>

        <footer class={styles.playAlongSummaryFooter}>
          <button class={styles.playAlongSummaryBtn} type="button" onClick={cancelSummary}>
            {t('learn.pa.summary.cancel')}
          </button>
          <button
            class={`${styles.playAlongSummaryBtn} ${styles.playAlongSummaryBtnPrimary}`}
            type="button"
            onClick={() => {
              trackEvent('exercise_summary_action', {
                exercise_id: props.result.exerciseId,
                action: 'continue_practice',
              })
              props.onDismiss()
              props.onContinuePractice()
            }}
          >
            {t('learn.pa.summary.continue')}
          </button>
        </footer>
      </section>
    </div>
  )
}

function MetricCard(props: {
  value: string
  label: string
  tone?: 'default' | 'success' | 'danger'
  accent?: 'accent'
}) {
  return (
    <div
      class={styles.playAlongSummaryMetric}
      data-tone={props.tone ?? 'default'}
      data-accent={props.accent ?? 'default'}
    >
      <span class={styles.playAlongSummaryMetricValue}>{props.value}</span>
      <span class={styles.playAlongSummaryMetricLabel}>{props.label}</span>
    </div>
  )
}

export function createPlayAlongSummary(opts: PlayAlongSummaryOptions) {
  const handle = createMountHandle(PlayAlongSummaryView)

  return {
    show(
      host: HTMLElement,
      result: ExerciseResult,
      extras: { streakExtended: boolean; xpGained: number },
      summary: PlayAlongExerciseSummary,
    ): void {
      handle.mount(host, {
        onContinuePractice: opts.onContinuePractice,
        onCancel: opts.onCancel,
        result,
        summary,
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
