import { createEffect, onMount, Show } from 'solid-js'
import { t } from '../i18n'
import { useApp } from '../store/AppCtx'
import { track, trackEvent } from '../telemetry'
import { icons } from '../ui/icons'
import { RecentMidiList } from '../ui/RecentMidiList'

// Playback surface for a loaded MIDI file. Mount happens when the store's
// mode transitions to 'play', which only occurs in `completePlayLoad`, so
// `loadedMidi` is already set by the time onMount runs for the fresh-load path.
// For the re-entry-from-live-or-learn path, loadedMidi was preserved from the
// earlier play session.
export function PlayMode() {
  const {
    services,
    trackPanel,
    dropzone,
    keyboardInput,
    openFilePicker,
    openLocalMidi,
    openSample,
    resetInteractionState,
  } = useApp()

  const hasMidi = () => services.store.state.loadedMidi !== null

  onMount(() => {
    const midi = services.store.state.loadedMidi
    const status = services.store.state.status
    if (!midi) {
      // Null MIDI can arrive two ways:
      // 1. User explicitly entered Play with nothing loaded yet.
      // 2. beginPlayLoad flipped mode='play' mid-load while status='loading'.
      if (status === 'loading') return
      resetInteractionState()
      services.renderer.clearMidi()
      trackPanel.close()
      dropzone.hide()
      keyboardInput.enable()
      document.title = `midee - ${t('topStrip.mode.play.label')}`
      return
    }

    resetInteractionState()
    const props = { duration_s: Math.round(midi.duration) }
    trackEvent('play_mode_entered', props)
    track('file_mode_entered', props)
  })

  createEffect(() => {
    const midi = services.store.state.loadedMidi
    if (!midi) return
    services.renderer.loadMidi(midi)
    trackPanel.render(midi)
    dropzone.hide()
    keyboardInput.enable()
    document.title = `${midi.name} - midee`
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
                onClick={() => openFilePicker('play')}
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
            onOpenMidi={(id, target) => openLocalMidi(id, target)}
            onOpenSample={(id, target) => openSample(id, target)}
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
        onOpenMidi={(id, target) => openLocalMidi(id, target)}
        onOpenSample={(id, target) => openSample(id, target)}
      />
    </Show>
  )
}
