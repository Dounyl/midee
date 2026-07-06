import { createContext, useContext } from 'solid-js'
import type {
  CreateExercisePageRuntimeOptions,
  ExercisePageRuntimeHandle,
  PlayAlongPageRuntimeHandle,
} from '@/features/learn/runtime/types'
import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { AppPublicStore } from './state'

export interface PlayRouteEnterOptions {
  skipAnalytics?: boolean
}

export interface LibraryOpenRequest {
  kind: 'picker' | 'recent'
  target?: 'play' | 'learn'
  entry?: { kind: 'local' | 'sample'; id: string }
}

export type LearnEnterRequest =
  | { kind: 'empty' }
  | { kind: 'current-midi' }
  | { kind: 'sample'; sampleId: string }
  | { kind: 'local'; id: string }

export interface AppActions {
  navigation: {
    toTarget(target: RouteTarget): void
  }
  home: {
    enter(): void
  }
  play: {
    enter(options?: PlayRouteEnterOptions): void
  }
  live: {
    enter(): void
  }
  library: {
    open(request: LibraryOpenRequest): Promise<void> | void
  }
  learn: {
    enterHub(signal?: AbortSignal): Promise<void>
    exitHub(): void
    enterExercise(route: ExerciseRouteId, signal?: AbortSignal): Promise<void>
    exitExercise(): void
    enter(request: LearnEnterRequest): Promise<void> | void
  }
  session: {
    resetInteractionState(): void
    primeInteractiveAudio(): void
  }
}

export interface LearnRuntimeFactories {
  createPlayAlongPageRuntime(): PlayAlongPageRuntimeHandle
  createExercisePageRuntime(options: CreateExercisePageRuntimeOptions): ExercisePageRuntimeHandle
}

// Context value threaded via `<AppCtx.Provider value={ctx}>`. Components read
// the public app store, express intent through `actions`, and opt into
// page-owned exercise runtimes through narrow factories instead of the entire
// runtime dependency bag.
export interface AppCtxValue {
  store: AppPublicStore
  actions: AppActions
  learnRuntime: LearnRuntimeFactories
}

export const AppCtx = createContext<AppCtxValue>()

export function useApp(): AppCtxValue {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp() called outside <AppCtx.Provider>')
  return v
}
