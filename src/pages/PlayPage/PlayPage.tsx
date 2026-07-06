import { onMount, Show } from 'solid-js'
import { icons } from '@/components/common/icons'
import { RecentMidiList } from '@/components/playback/RecentMidiList'
import { t } from '@/i18n'
import { useApp } from '@/stores/app/AppCtx'
import styles from './PlayPage.module.css'

export function PlayPage() {
  const { actions, store } = useApp()
  const hasMidi = () => store.state.loadedMidi !== null

  onMount(() => {
    actions.play.enter()
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
        currentName={store.state.loadedMidi?.name ?? null}
        emptyLabel={t('midiLibrary.emptyHome')}
        onOpen={(request) => actions.library.open(request)}
      />
    </Show>
  )
}
