import type { AppIntent } from '@/app/runtime/intents'
import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type {
  LearnEnterRequest,
  LibraryOpenRequest,
  PlayRouteEnterOptions,
} from '@/stores/app/AppCtx'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { MidiFile } from '@/types/midi/types'

export interface AppIntentDriver {
  navigate(target: RouteTarget, options?: { replace?: boolean }): void
  enterPlayRoute(options?: PlayRouteEnterOptions): void
  enterLiveRoute(): void
  openLibraryRequest(request: LibraryOpenRequest): Promise<void> | void
  enterLearnHub(signal?: AbortSignal): Promise<void>
  exitLearnHub(): void
  enterExerciseRoute(route: ExerciseRouteId, signal?: AbortSignal): Promise<void>
  exitExerciseRoute(): void
  enterLearnRequest(request: LearnEnterRequest): Promise<void> | void
  openPreparedPlayAlong(midi: MidiFile): Promise<void>
  resetInteractionState(): void
  primeInteractiveAudio(): void
}

export class AppIntentDispatcher {
  constructor(private readonly driver: AppIntentDriver) {}

  dispatch(intent: AppIntent): Promise<void> | void {
    switch (intent.kind) {
      case 'navigation.navigate':
        this.driver.navigate(intent.target, intent.options)
        return
      case 'route.play.enter':
        this.driver.enterPlayRoute(intent.options)
        return
      case 'route.live.enter':
        this.driver.enterLiveRoute()
        return
      case 'library.open':
        return this.driver.openLibraryRequest(intent.request)
      case 'learn.hub.enter':
        return this.driver.enterLearnHub(intent.signal)
      case 'learn.hub.exit':
        this.driver.exitLearnHub()
        return
      case 'learn.exercise.enter':
        return this.driver.enterExerciseRoute(intent.routeId, intent.signal)
      case 'learn.exercise.exit':
        this.driver.exitExerciseRoute()
        return
      case 'learn.request':
        return this.driver.enterLearnRequest(intent.request)
      case 'learn.playAlong.openPrepared':
        return this.driver.openPreparedPlayAlong(intent.midi)
      case 'session.resetInteraction':
        this.driver.resetInteractionState()
        return
      case 'session.primeInteractiveAudio':
        this.driver.primeInteractiveAudio()
        return
    }
  }
}
