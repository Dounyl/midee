import { useNavigate } from '@solidjs/router'
import { onCleanup, onMount } from 'solid-js'
import { sightReadingDescriptor } from '@/features/learn/exercises/sight-reading'
import { sightReadingMeta } from '@/features/learn/exercises/sight-reading/meta'
import { LEARN_HUB_PATH } from '@/features/routing/learnRoutes'
import { t } from '@/i18n'
import { useApp } from '@/stores/app/AppCtx'
import { LearnLayout, learnLayoutStyles } from './LearnLayout'

export function LearnSightReadingPage() {
  const { actions, learnRuntime } = useApp()
  const navigate = useNavigate()
  const runtime = learnRuntime.createExercisePageRuntime({
    routeId: 'sight-reading',
    descriptor: sightReadingDescriptor,
    onNext: () => navigate(LEARN_HUB_PATH),
  })

  onMount(() => {
    const abort = new AbortController()
    void (async () => {
      await actions.learn.enterExercise('sight-reading', abort.signal)
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
