import type { AppRuntimeDeps, ModeRequest } from './types'

interface ModeRequestHandlers {
  ensureLearnController: () => Promise<{ closeActiveExercise(reason: 'abandoned'): void }>
  enterLiveMode: () => void
  enterPlayMode: () => void
}

export function applyModeRequest(
  store: Pick<AppRuntimeDeps['store'], 'state' | 'setState' | 'enterPlayLanding'>,
  mode: ModeRequest,
  handlers: ModeRequestHandlers,
): void {
  if (mode === 'live') {
    handlers.enterLiveMode()
    return
  }
  if (mode === 'learn') {
    if (store.state.mode === 'learn') {
      void handlers
        .ensureLearnController()
        .then((controller) => controller.closeActiveExercise('abandoned'))
      return
    }
    store.setState('mode', 'learn')
    return
  }
  if (store.state.loadedMidi) {
    handlers.enterPlayMode()
    return
  }
  store.enterPlayLanding()
}
