import { App } from '@/app/AppRuntime'
import { createAppActions } from '@/app/runtime/actions'
import type { AppRuntimeInstance, AppShellHandles } from '@/app/runtime/types'
import { assertDefined } from '@/lib/assert'
import type { AppActions, AppCtxValue } from '@/stores/app/AppCtx'
import { createAppStore } from '@/stores/app/state'

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
export async function createApp(handles: AppShellHandles): Promise<AppRuntimeInstance> {
  const store = createAppStore()
  const app = new App(store)
  let actions: AppActions
  try {
    actions = await app.init(
      {
        canvas: assertDefined(handles.canvas, 'createApp() called without a canvas handle'),
        overlay: assertDefined(handles.overlay, 'createApp() called without an overlay handle'),
      },
      createAppActions,
    )
  } catch (error) {
    try {
      app.dispose()
    } catch {
      // A failed boot can leave the runtime only partially initialized.
    }
    throw error
  }
  const ctx: AppCtxValue = {
    store: app.store,
    actions,
    learnRuntime: {
      createPlayAlongPageRuntime: () => app.createPlayAlongPageRuntime(),
      createExercisePageRuntime: (options) => app.createExercisePageRuntime(options),
    },
  }
  return {
    ctx,
    bench: {
      prepareBenchPlayback: (midi) => app.prepareBenchPlayback(midi),
      startBenchPlayback: () => app.startBenchPlayback(),
    },
    dispose: () => app.dispose(),
  }
}
