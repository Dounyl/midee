import { App } from './app'
import { AppCtx as _AppCtx, type AppActions, type AppCtxValue } from './store/AppCtx'
import { createAppStore, resolveInitialAppMode } from './store/state'

// Boots the app. Constructs the single `AppStore`, hands it to the `App`
// orchestrator (which owns the long-lived subsystems — renderer, synth, MIDI,
// metronome, looper, UI class shells), runs `init()`, and returns the Solid
// context value that flows through `<AppCtx.Provider value={ctx}>`.
//
// T2b status: the plan originally called for splitting `App` into `createApp()`
// + `actions.ts` (free-function imperative helpers). We scoped that back:
// every subsystem is already its own extracted class/module, so `App` is now
// a *subsystem orchestrator*, not a god-class. Splitting the remaining ~40
// methods into module functions would just turn `this.x` into
// `ctx.x`/module-scope — pure cost, no architectural win, because the
// interwoven state (pedal merging, export lifecycle, session pending, sustain
// set, chord-detect throttling) has to live *somewhere* and a class field is
// the cheapest container. The module-scope `appState` singleton that motivated
// T2b has been removed; the store is now constructed here and threaded in.
export async function createApp(): Promise<{ ctx: AppCtxValue; app: App }> {
  const store = createAppStore({ initialMode: resolveInitialAppMode() })
  const app = new App(store)
  await app.init()
  const actions: AppActions = {
    mode: {
      request: (mode) => app.requestMode(mode),
      mount: (mode, options) => app.mountMode(mode, options),
    },
    library: {
      open: (request) => app.openLibraryRequest(request),
    },
    learn: {
      mount: (signal) => app.mountLearnMode(signal),
      exit: () => app.exitLearnMode(),
      enter: (request) => app.enterLearnRequest(request),
    },
    session: {
      resetInteractionState: () => app.resetInteractionState(),
      primeInteractiveAudio: () => app.primeInteractiveAudio(),
    },
  }
  return {
    ctx: {
      services: app.services,
      store: app.store,
      actions,
    },
    app,
  }
}

export { _AppCtx as AppCtx }
