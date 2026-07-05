import { createMemo, createResource, onCleanup, onMount, Show } from 'solid-js'
import { t } from '../../i18n'
import { playAlongMeta } from '@/features/learn/exercises/play-along/meta'
import { useApp } from '../../store/AppCtx'
import { icons } from '../../ui/icons'
import { RecentMidiList } from '../../ui/RecentMidiList'
import { LearnLayout, learnLayoutStyles } from './LearnLayout'
import styles from './LearnPlayAlongPage.module.css'

export function LearnPlayAlongPage() {
  const { actions, ensureLearnController } = useApp()
  const [learnController] = createResource(() => ensureLearnController())
  const currentMidi = () => learnController()?.learnState.state.loadedMidi ?? null
  const isExerciseView = createMemo(() => learnController()?.view.value === 'exercise')
  const showEmptyState = createMemo(() => !isExerciseView())
  const activateCard = () => {
    if (currentMidi()) {
      void learnController()?.startPlayAlong()
      return
    }
    actions.library.open({ kind: 'picker', target: 'learn' })
  }

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
      <div
        class={`${learnLayoutStyles.learnRouteShell} ${learnLayoutStyles.learnRouteShellPlayalong}`}
      >
        <Show when={showEmptyState()}>
          <div class={styles.learnPlayalongEmptyState}>
            <section
              class={styles.learnPlayalongCard}
              data-category={playAlongMeta.category}
              role="button"
              tabindex={0}
              onClick={activateCard}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                activateCard()
              }}
            >
              <div class={styles.learnPlayalongCardBadge} innerHTML={icons.upload(24)} />
              <div class={styles.learnPlayalongCardBody}>
                <span class={styles.learnPlayalongCardKicker}>{t('learn.hub.recommended')}</span>
                <h2 class={styles.learnPlayalongCardTitle}>{playAlongMeta.title}</h2>
                <p class={styles.learnPlayalongCardBlurb}>{playAlongMeta.blurb}</p>
              </div>
              <div class={styles.learnPlayalongCardActions}>
                <Show
                  when={currentMidi()}
                  fallback={
                    <button
                      class={styles.learnPlayalongCardPrimary}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        actions.library.open({ kind: 'picker', target: 'learn' })
                      }}
                    >
                      <span
                        class={styles.learnPlayalongCardPrimaryIcon}
                        aria-hidden="true"
                        innerHTML={icons.upload(16)}
                      />
                      <span class={styles.learnPlayalongCardPrimaryLabel}>
                        {t('learn.hub.uploadMidi')}
                      </span>
                    </button>
                  }
                >
                  {(midi) => (
                    <>
                      <button
                        class={styles.learnPlayalongCardPrimary}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void learnController()?.startPlayAlong()
                        }}
                      >
                        <span
                          class={styles.learnPlayalongCardPrimaryIcon}
                          aria-hidden="true"
                          innerHTML={icons.play(14)}
                        />
                        <span class={styles.learnPlayalongCardPrimaryLabel}>
                          {t('learn.hub.startWith', { name: midi().name })}
                        </span>
                      </button>
                      <button
                        class={styles.learnPlayalongCardSecondary}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          actions.library.open({ kind: 'picker', target: 'learn' })
                        }}
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
              title={t('learn.hub.library')}
              eyebrow={null}
              target="learn"
              tone="play-empty"
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
