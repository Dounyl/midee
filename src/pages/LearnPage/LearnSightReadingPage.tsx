import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { useAppShell } from '@/app/AppShellContext'
import { sightReadingMeta } from '@/features/learn/exercises/sight-reading/meta'
import { useApp } from '@/stores/app/AppCtx'
import { t } from '../../i18n'
import { sightReadingDescriptor } from '../../learn/exercises/sight-reading'
import { LearnLayout, learnLayoutStyles } from './LearnLayout'
import { RoutedExerciseRuntime } from './RoutedExerciseRuntime'

export function LearnSightReadingPage() {
  const { actions, services } = useApp()
  const { overlay } = useAppShell()
  const navigate = useNavigate()

  onMount(() => {
    const abort = new AbortController()
    const runtime = new RoutedExerciseRuntime(services, overlay, sightReadingDescriptor, () =>
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
    <LearnLayout title={sightReadingMeta.title} blurb={sightReadingMeta.blurb} backToHub>
      <div class={learnLayoutStyles.learnRouteCard}>
        <div class={learnLayoutStyles.learnRouteCardHint}>{t('learn.hub.recommended')}</div>
        <p class={learnLayoutStyles.learnRoutePageBlurb}>
          {t('learn.exercise.sightReading.blurb')}
        </p>
      </div>
    </LearnLayout>
  )
}
