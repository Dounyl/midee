import { createMemo, onCleanup, onMount, Show } from 'solid-js'
import { icons } from '@/components/common/icons'
import { RecentMidiList } from '@/components/playback/RecentMidiList'
import { playAlongMeta } from '@/features/learn/exercises/play-along/meta'
import { t } from '@/i18n'
import { useApp } from '@/stores/app/AppCtx'
import { LearnLayout, learnLayoutStyles } from './LearnLayout'
import styles from './LearnPlayAlongPage.module.css'

export function LearnPlayAlongPage() {
  const { actions, learnRuntime } = useApp()
  const runtime = learnRuntime.createPlayAlongPageRuntime()
  const currentMidi = () => runtime.learnState.state.loadedMidi ?? null
  const isExerciseView = createMemo(() => runtime.view.value === 'exercise')
  const showEmptyState = createMemo(() => !isExerciseView())
  const activateCard = () => {
    if (currentMidi()) {
      void runtime.startPlayAlong()
      return
    }
    actions.library.open({ kind: 'picker', target: 'learn' })
  }

  onMount(() => {
    const abort = new AbortController()
    void actions.learn.enterExercise('play-along', abort.signal)
    runtime.enter()
    onCleanup(() => {
      abort.abort()
      runtime.exit()
      actions.learn.exitExercise()
    })
  })

  return (
    <LearnLayout backToHub>
      <Show when={isExerciseView()}>
        <div class={styles.learnPlayalongBackRow}>
          <button
            type="button"
            class={styles.learnPlayalongBackButton}
            aria-label={t('learn.pa.backToListAria')}
            title={t('learn.pa.backToListTip')}
            onClick={() => runtime.returnToList()}
          >
            <span
              class={styles.learnPlayalongBackButtonIcon}
              aria-hidden="true"
              innerHTML={icons.skipBack(14)}
            />
            <span>{t('learn.pa.backToList')}</span>
          </button>
        </div>
      </Show>
      <div
        class={`${learnLayoutStyles.learnRouteShell} ${learnLayoutStyles.learnRouteShellPlayalong}`}
      >
        <Show when={showEmptyState()}>
          <div class={styles.learnPlayalongEmptyState}>
            {/* biome-ignore lint/a11y/useSemanticElements: the card keeps nested action buttons, so a semantic <button> wrapper would be invalid here */}
            <div
              class={styles.learnPlayalongCard}
              data-category={playAlongMeta.category}
              role="button"
              tabIndex={0}
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
                          void runtime.startPlayAlong()
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
            </div>
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
