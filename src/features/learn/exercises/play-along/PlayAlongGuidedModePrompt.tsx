import { createSignal, onCleanup, onMount } from 'solid-js'
import { createMountHandle } from '@/features/learn/ui/mountComponent'
import { t } from '@/i18n'
import type { PlayAlongGuidedMode } from './state'
import styles from './PlayAlongGuidedModePrompt.module.css'

export interface PlayAlongGuidedModePromptOptions {
  reason: 'start' | 'replay'
  fallbackMode: PlayAlongGuidedMode
  onConfirm: (mode: PlayAlongGuidedMode) => void
  countdownSeconds?: number
}

interface ViewProps extends PlayAlongGuidedModePromptOptions {
  onDismiss: () => void
}

function PlayAlongGuidedModePromptView(props: ViewProps) {
  const totalSeconds = props.countdownSeconds ?? 20
  const [selectedMode, setSelectedMode] = createSignal<PlayAlongGuidedMode>(props.fallbackMode)
  const [secondsLeft, setSecondsLeft] = createSignal(totalSeconds)
  let confirmed = false

  const confirm = (mode: PlayAlongGuidedMode) => {
    if (confirmed) return
    confirmed = true
    props.onDismiss()
    props.onConfirm(mode)
  }

  onMount(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          queueMicrotask(() => confirm(selectedMode()))
          return 0
        }
        return current - 1
      })
    }, 1000)
    onCleanup(() => window.clearInterval(timer))
  })

  const title = () =>
    props.reason === 'replay' ? t('learn.pa.prompt.replayTitle') : t('learn.pa.prompt.startTitle')
  const subtitle = () =>
    props.reason === 'replay'
      ? t('learn.pa.prompt.replaySubtitle')
      : t('learn.pa.prompt.startSubtitle')

  return (
    <div class={styles.prompt}>
      <section class={styles.card} role="dialog" aria-modal="true" aria-labelledby="play-along-mode-title">
        <header class={styles.header}>
          <p class={styles.eyebrow}>{t('learn.pa.modeLabel')}</p>
          <h2 id="play-along-mode-title" class={styles.title}>
            {title()}
          </h2>
          <p class={styles.subtitle}>{subtitle()}</p>
        </header>

        <div class={styles.modeGrid}>
          <button
            class={styles.modeCard}
            aria-pressed={selectedMode() === 'demo'}
            data-active={selectedMode() === 'demo'}
            type="button"
            onClick={() => setSelectedMode('demo')}
          >
            <span class={styles.modeTitle}>{t('learn.pa.modeDemoLabel')}</span>
            <span class={styles.modeBody}>{t('learn.pa.modeDemoTip')}</span>
          </button>
          <button
            class={styles.modeCard}
            aria-pressed={selectedMode() === 'practice'}
            data-active={selectedMode() === 'practice'}
            type="button"
            onClick={() => setSelectedMode('practice')}
          >
            <span class={styles.modeTitle}>{t('learn.pa.modePracticeLabel')}</span>
            <span class={styles.modeBody}>{t('learn.pa.modePracticeTip')}</span>
          </button>
        </div>

        <footer class={styles.footer}>
          <div class={styles.countdown}>
            {t('learn.pa.prompt.defaultCountdown', {
              mode:
                props.fallbackMode === 'practice'
                  ? t('learn.pa.modePracticeLabel')
                  : t('learn.pa.modeDemoLabel'),
              seconds: secondsLeft(),
            })}
          </div>
          <button class={styles.startBtn} type="button" onClick={() => confirm(selectedMode())}>
            {t('learn.pa.prompt.startNow')}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function createPlayAlongGuidedModePrompt(opts: PlayAlongGuidedModePromptOptions) {
  const handle = createMountHandle(PlayAlongGuidedModePromptView)

  return {
    show(host: HTMLElement): void {
      handle.mount(host, {
        ...opts,
        onDismiss: () => handle.unmount(),
      })
    },
    dismiss(): void {
      handle.unmount()
    },
  }
}
