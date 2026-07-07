import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type {
  LearnEnterRequest,
  LibraryOpenRequest,
  PlayRouteEnterOptions,
} from '@/stores/app/AppCtx'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { MidiFile } from '@/types/midi/types'

export type AppIntent =
  | { kind: 'navigation.navigate'; target: RouteTarget; options?: { replace?: boolean } }
  | { kind: 'route.play.enter'; options?: PlayRouteEnterOptions }
  | { kind: 'route.live.enter' }
  | { kind: 'library.open'; request: LibraryOpenRequest }
  | { kind: 'learn.hub.enter'; signal?: AbortSignal }
  | { kind: 'learn.hub.exit' }
  | { kind: 'learn.exercise.enter'; routeId: ExerciseRouteId; signal?: AbortSignal }
  | { kind: 'learn.exercise.exit' }
  | { kind: 'learn.request'; request: LearnEnterRequest }
  | { kind: 'learn.playAlong.openPrepared'; midi: MidiFile }
  | { kind: 'session.resetInteraction' }
  | { kind: 'session.primeInteractiveAudio' }
