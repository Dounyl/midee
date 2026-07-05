import { createEffect, createRenderEffect, onMount, Show } from 'solid-js'
import { t } from '../../i18n'
import { useApp } from '../../store/AppCtx'
import { track, trackEvent } from '../../telemetry'
import { icons } from '../../ui/icons'
import { RecentMidiList } from '../../ui/RecentMidiList'
import '../../modes/PlayMode.css'

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
        <div class="play-empty-shell">
          <section class="hero-card play-empty-card">
            <div class="hero-card__badge" innerHTML={icons.upload(24)} />
            <div class="hero-card__body">
              <span class="hero-card__kicker">{t('topStrip.context.play.kicker')}</span>
              <h2 class="hero-card__title">{t('topStrip.context.play.fallback')}</h2>
              <p class="hero-card__blurb">{t('midiLibrary.emptyHome')}</p>
            </div>
            <div class="hero-card__actions">
              <button
                class="hero-card__primary"
                type="button"
                onClick={() => actions.library.open({ kind: 'picker', target: 'play' })}
              >
                <span
                  class="hero-card__primary-icon"
                  aria-hidden="true"
                  innerHTML={icons.upload(16)}
                />
                <span class="hero-card__primary-label">{t('home.cta.openMidi')}</span>
              </button>
            </div>
          </section>
          <RecentMidiList
            class="play-empty-library"
            title={t('midiLibrary.homeLabel')}
            target="play"
            currentName={null}
            emptyLabel={t('midiLibrary.emptyHome')}
            variant="inline"
            onOpen={(request) => actions.library.open(request)}
          />
        </div>
      }
    >
      <RecentMidiList
        class="recent-midi-card--play"
        title={t('midiLibrary.homeLabel')}
        target="play"
        currentName={services.store.state.loadedMidi?.name ?? null}
        emptyLabel={t('midiLibrary.emptyHome')}
        onOpen={(request) => actions.library.open(request)}
      />
    </Show>
  )
}
