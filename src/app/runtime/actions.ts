import { navigateToMode } from '@/routing/routerBridge'
import type {
  AppActions,
  LearnEnterRequest,
  LearnMountTarget,
  LibraryOpenRequest,
  PlayRouteEnterOptions,
} from '@/stores/app/AppCtx'

export interface AppActionDriver {
  enterHomeRoute(): void
  enterPlayRoute(options?: PlayRouteEnterOptions): void
  enterLiveRoute(): void
  openLibraryRequest(request: LibraryOpenRequest): Promise<void> | void
  enterLearnRoute(target: LearnMountTarget, signal?: AbortSignal): Promise<void>
  exitLearnRoute(): void
  enterLearnRequest(request: LearnEnterRequest): Promise<void> | void
  resetInteractionState(): void
  primeInteractiveAudio(): void
}

export function createAppActions(driver: AppActionDriver): AppActions {
  return {
    navigation: {
      toMode: (mode) => {
        navigateToMode(mode)
      },
    },
    home: {
      enter: () => driver.enterHomeRoute(),
    },
    play: {
      enter: (options) => driver.enterPlayRoute(options),
    },
    live: {
      enter: () => driver.enterLiveRoute(),
    },
    library: {
      open: (request) => driver.openLibraryRequest(request),
    },
    learn: {
      enterRoute: (target, signal) => driver.enterLearnRoute(target, signal),
      exitRoute: () => driver.exitLearnRoute(),
      enter: (request) => driver.enterLearnRequest(request),
    },
    session: {
      resetInteractionState: () => driver.resetInteractionState(),
      primeInteractiveAudio: () => driver.primeInteractiveAudio(),
    },
  }
}
