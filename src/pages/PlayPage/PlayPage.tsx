import { createEffect, createRenderEffect, onMount, Show } from 'solid-js'
import { useApp } from '@/stores/app/AppCtx'
import { t } from '../../i18n'
import { track, trackEvent } from '../../telemetry'
import { icons } from '../../ui/icons'
import { RecentMidiList } from '../../ui/RecentMidiList'
import styles from './PlayPage.module.css'

export function PlayPage() {
  const { services, actions, store } = useApp()
  const hasMidi = () => services.store.state.loadedMidi !== null

  createRenderEffect(() => {
    if (store.state.loadedMidi) {
      store.enterPlay(false)
      return
    }
    store.enterPlayLanding()
  })

  onMount(() => {
    const midi = services.store.state.loadedMidi
    const status = services.store.state.status
    if (!midi) {
      if (status === 'loading') return
      actions.play.enter()
      return
    }

    const props = { duration_s: Math.round(midi.duration) }
    trackEvent('play_mode_entered', props)
    track('file_mode_entered', props)
  })

  createEffect(() => {
    const midi = services.store.state.loadedMidi
    if (!midi) return
    actions.play.enter({ skipAnalytics: true })
  })

  return (
    <Show
      when={hasMidi()}
      fallback={
        <div class={styles.playEmptyShell}>
          <section class={styles.playEmptyCard}>
            <div class={styles.playEmptyCardBadge} innerHTML={icons.upload(24)} />
            <div class={styles.playEmptyCardBody}>
              <span class={styles.playEmptyCardKicker}>{t('topStrip.context.play.kicker')}</span>
              <h2 class={styles.playEmptyCardTitle}>{t('topStrip.context.play.fallback')}</h2>
              <p class={styles.playEmptyCardBlurb}>{t('midiLibrary.emptyHome')}</p>
            </div>
            <div class={styles.playEmptyCardActions}>
              <button
                class={styles.playEmptyCardPrimary}
                type="button"
                onClick={() => actions.library.open({ kind: 'picker', target: 'play' })}
              >
                <span
                  class={styles.playEmptyCardPrimaryIcon}
                  aria-hidden="true"
                  innerHTML={icons.upload(16)}
                />
                <span class={styles.playEmptyCardPrimaryLabel}>{t('home.cta.openMidi')}</span>
              </button>
            </div>
          </section>
          <RecentMidiList
            title={t('midiLibrary.homeLabel')}
            target="play"
            tone="play-empty"
            currentName={null}
            emptyLabel={t('midiLibrary.emptyHome')}
            variant="inline"
            onOpen={(request) => actions.library.open(request)}
          />
        </div>
      }
    >
      <RecentMidiList
        title={t('midiLibrary.homeLabel')}
        target="play"
        currentName={services.store.state.loadedMidi?.name ?? null}
        emptyLabel={t('midiLibrary.emptyHome')}
        onOpen={(request) => actions.library.open(request)}
      />
    </Show>
  )
}
