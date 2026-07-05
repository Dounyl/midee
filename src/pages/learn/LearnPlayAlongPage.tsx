import { createMemo, createResource, onCleanup, onMount, Show } from 'solid-js'
import { t } from '../../i18n'
import '../../learn/hub/LearnHub.css'
import { playAlongDescriptor } from '../../learn/exercises/play-along'
import { useApp } from '../../store/AppCtx'
import { icons } from '../../ui/icons'
import { RecentMidiList } from '../../ui/RecentMidiList'
import { LearnLayout } from './LearnLayout'

export function LearnPlayAlongPage() {
  const { actions, ensureLearnController } = useApp()
  const [learnController] = createResource(() => ensureLearnController())
  const currentMidi = () => learnController()?.learnState.state.loadedMidi ?? null
  const isExerciseView = createMemo(() => learnController()?.view.value === 'exercise')
  const showEmptyState = createMemo(() => !isExerciseView())

  onMount(() => {
    const abort = new AbortController()
    void actions.learn.enterRoute('play-along', abort.signal)
    onCleanup(() => {
      abort.abort()
      actions.learn.exitRoute()
    })
  })

  return (
    <LearnLayout backToHub>
      <div class="learn-route-shell learn-route-shell--playalong">
        <Show when={showEmptyState()}>
          <div class="learn-playalong-empty-state">
            <section class="hero-card play-empty-card" data-category={playAlongDescriptor.category}>
              <div class="hero-card__badge" innerHTML={icons.upload(24)} />
              <div class="hero-card__body">
                <span class="hero-card__kicker">{t('learn.hub.recommended')}</span>
                <h2 class="hero-card__title">{playAlongDescriptor.title}</h2>
                <p class="hero-card__blurb">{playAlongDescriptor.blurb}</p>
              </div>
              <div class="hero-card__actions">
                <Show
                  when={currentMidi()}
                  fallback={
                    <button
                      class="hero-card__primary"
                      type="button"
                      onClick={() => actions.library.open({ kind: 'picker', target: 'learn' })}
                    >
                      <span
                        class="hero-card__primary-icon"
                        aria-hidden="true"
                        innerHTML={icons.upload(16)}
                      />
                        <span class="hero-card__primary-label">{t('learn.hub.uploadMidi')}</span>
                      </button>
                  }
                >
                  {(midi) => (
                    <>
                      <button
                        class="hero-card__primary"
                        type="button"
                        onClick={() => void learnController()?.startPlayAlong()}
                      >
                        <span
                          class="hero-card__primary-icon"
                          aria-hidden="true"
                          innerHTML={icons.play(14)}
                        />
                        <span class="hero-card__primary-label">
                          {t('learn.hub.startWith', { name: midi().name })}
                        </span>
                      </button>
                      <button
                        class="hero-card__secondary"
                        type="button"
                        onClick={() => actions.library.open({ kind: 'picker', target: 'learn' })}
                      >
                        <span innerHTML={icons.upload(14)} />
                        <span>{t('learn.hub.uploadMidi')}</span>
                      </button>
                    </>
                  )}
                </Show>
              </div>
            </section>
            <RecentMidiList
              class="play-empty-library learn-playalong-library"
              title={t('learn.hub.library')}
              eyebrow={null}
              target="learn"
              currentName={currentMidi()?.name ?? null}
              emptyLabel={t('midiLibrary.emptyLearn')}
              variant="inline"
              onOpen={(request) => actions.library.open(request)}
            />
          </div>
        </Show>
      </div>
    </LearnLayout>
  )
}
