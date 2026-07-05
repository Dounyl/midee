import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { useAppShell } from '@/app/AppShellContext'
import { intervalsMeta } from '@/features/learn/exercises/intervals/meta'
import { useApp } from '@/stores/app/AppCtx'
import { intervalsDescriptor } from '../../learn/exercises/intervals'
import { LearnLayout } from './LearnLayout'
import { RoutedExerciseRuntime } from './RoutedExerciseRuntime'

export function LearnIntervalsPage() {
  const { actions, services } = useApp()
  const { overlay } = useAppShell()
  const navigate = useNavigate()

  onMount(() => {
    const abort = new AbortController()
    const runtime = new RoutedExerciseRuntime(services, overlay, intervalsDescriptor, () =>
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
    <LearnLayout title={intervalsMeta.title} blurb={intervalsMeta.blurb} backToHub>
      {/* <div class={learnLayoutStyles.learnRouteCard}>
        <div class={learnLayoutStyles.learnRouteCardHint}>{t('learn.hub.recommended')}</div>
        <p class={learnLayoutStyles.learnRoutePageBlurb}>{t('learn.exercise.intervals.blurb')}</p>
      </div> */}
    </LearnLayout>
  )
}
