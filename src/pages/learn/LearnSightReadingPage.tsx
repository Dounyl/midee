import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { t } from '../../i18n'
import { sightReadingDescriptor } from '../../learn/exercises/sight-reading'
import { useApp } from '../../store/AppCtx'
import { LearnLayout } from './LearnLayout'
import { RoutedExerciseRuntime } from './RoutedExerciseRuntime'

export function LearnSightReadingPage() {
  const { actions, services } = useApp()
  const navigate = useNavigate()

  onMount(() => {
    const abort = new AbortController()
    const runtime = new RoutedExerciseRuntime(services, sightReadingDescriptor, () =>
      navigate('/learn'),
    )
    void (async () => {
      await actions.learn.enterRoute('sight-reading', abort.signal)
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
      title={sightReadingDescriptor.title}
      blurb={t('learn.exercise.sightReading.blurb')}
      backToHub
    >
      <div class="learn-route-card">
        <div class="learn-route-card__hint">{t('learn.hub.recommended')}</div>
        <p class="learn-route-page__blurb">{t('learn.exercise.sightReading.blurb')}</p>
      </div>
    </LearnLayout>
  )
}
