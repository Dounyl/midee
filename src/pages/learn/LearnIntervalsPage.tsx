import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { t } from '../../i18n'
import { intervalsDescriptor } from '../../learn/exercises/intervals'
import { useApp } from '../../store/AppCtx'
import { LearnLayout } from './LearnLayout'
import { RoutedExerciseRuntime } from './RoutedExerciseRuntime'

export function LearnIntervalsPage() {
  const { actions, services } = useApp()
  const navigate = useNavigate()

  onMount(() => {
    const abort = new AbortController()
    const runtime = new RoutedExerciseRuntime(services, intervalsDescriptor, () =>
      navigate('/learn'),
    )
    void (async () => {
      await actions.learn.enterRoute('intervals', abort.signal)
      if (abort.signal.aborted) return
      await runtime.enter()
    })()
    onCleanup(() => {
      abort.abort()
      runtime.exit()
      actions.learn.exitRoute()
    })
  })

  return (
    <LearnLayout
      title={intervalsDescriptor.title}
      blurb={t('learn.exercise.intervals.blurb')}
      backToHub
    >
      {/* <div class="learn-route-card">
        <div class="learn-route-card__hint">{t('learn.hub.recommended')}</div>
        <p class="learn-route-page__blurb">{t('learn.exercise.intervals.blurb')}</p>
      </div> */}
    </LearnLayout>
  )
}
