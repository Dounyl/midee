import { onCleanup, onMount } from 'solid-js'
import { t } from '../i18n'
import { useApp } from '../store/AppCtx'
import { RecentMidiList } from '../ui/RecentMidiList'

// Learn mode shell delegates controller lifecycle to `actions.learn`, keeping
// the component focused on mount/unmount timing instead of controller details.
export function LearnMode() {
  const { actions } = useApp()

  onMount(() => {
    const abort = new AbortController()
    void actions.learn.mount(abort.signal)
    onCleanup(() => {
      abort.abort()
      actions.learn.exit()
    })
  })

  return (
    <RecentMidiList
      class="recent-midi-card--learn-page"
      title={t('learn.hub.library')}
      target="learn"
      currentName={null}
      emptyLabel={t('midiLibrary.emptyLearn')}
      onOpen={(request) => actions.library.open(request)}
    />
  )
}
