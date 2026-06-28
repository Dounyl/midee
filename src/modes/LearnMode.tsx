import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { t } from '../i18n'
import { useApp } from '../store/AppCtx'
import { RecentMidiList } from '../ui/RecentMidiList'
import type { LearnController } from './LearnController'

// Learn mode shell. LearnController is dynamic-imported on first entry —
// onMount awaits the chunk, then calls enter(). If the user navigates away
// before the chunk lands, the `cancelled` flag stops us from calling enter()
// against a controller no one's watching, and onCleanup is a no-op since
// `controller` is still null.
export function LearnMode() {
  const { ensureLearnController, openLocalMidi, openSample } = useApp()
  const [controller, setController] = createSignal<LearnController | null>(null)
  let cancelled = false
  onMount(() => {
    void ensureLearnController().then((c) => {
      if (cancelled) return
      setController(c)
      c.enter()
    })
  })
  onCleanup(() => {
    cancelled = true
    controller()?.exit()
  })
  return (
    <>
      <Show when={controller()}>
        {(c) => (
          <RecentMidiList
            class="recent-midi-card--learn-page"
            title={t('learn.hub.library')}
            target="learn"
            currentName={c().learnState.state.loadedMidi?.name ?? null}
            emptyLabel={t('midiLibrary.emptyLearn')}
            onOpenMidi={(id, target) => openLocalMidi(id, target)}
            onOpenSample={(id, target) => openSample(id, target)}
          />
        )}
      </Show>
    </>
  )
}
