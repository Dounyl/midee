import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { intervalsDescriptor } from '@/features/learn/exercises/intervals'
import { intervalsMeta } from '@/features/learn/exercises/intervals/meta'
import { LEARN_HUB_PATH } from '@/features/routing/learnRoutes'
import { useApp } from '@/stores/app/AppCtx'
import { LearnLayout } from './LearnLayout'

export function LearnIntervalsPage() {
  const { actions, learnRuntime } = useApp()
  const navigate = useNavigate()
  const runtime = learnRuntime.createExercisePageRuntime({
    routeId: 'intervals',
    descriptor: intervalsDescriptor,
    onNext: () => navigate(LEARN_HUB_PATH),
  })

  onMount(() => {
    const abort = new AbortController()
    void (async () => {
      await actions.learn.enterExercise('intervals', abort.signal)
      if (abort.signal.aborted) return
      await runtime.enter()
    })()
    onCleanup(() => {
      abort.abort()
      runtime.exit()
      actions.learn.exitExercise()
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
