import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { vi } from 'vitest'
import { createLearnState } from '@/features/learn/core/LearnState'
import type {
  CreateExercisePageRuntimeOptions,
  ExercisePageRuntimeHandle,
  PlayAlongPageRuntimeHandle,
} from '@/features/learn/runtime/types'
import { AppCtx, type AppCtxValue } from '@/stores/app/AppCtx'
import { createEventSignal } from '@/stores/app/eventSignal'
import { createAppStore } from '@/stores/app/state'

function makePlayAlongRuntime(): PlayAlongPageRuntimeHandle {
  return {
    routeId: 'play-along',
    learnState: createLearnState(),
    view: createEventSignal<'page' | 'exercise'>('page'),
    enter: vi.fn(),
    exit: vi.fn(),
    startPlayAlong: vi.fn(async () => {}),
    loadPreparedMidi: vi.fn(async () => {}),
    getConsoleState: vi.fn(() => ({ enabled: false, baseKey: null, current: 0 })),
    setTranspose: vi.fn(),
    getLoadedMidi: vi.fn(() => null),
  }
}

function makeExerciseRuntime(): ExercisePageRuntimeHandle {
  return {
    routeId: 'intervals',
    enter: vi.fn(async () => {}),
    exit: vi.fn(),
  }
}

function makeFakeCtx(): AppCtxValue {
  const store = createAppStore()
  return {
    store,
    actions: {
      navigation: {
        toTarget: vi.fn(),
      },
      home: {
        enter: vi.fn(),
      },
      play: {
        enter: vi.fn(),
      },
      live: {
        enter: vi.fn(),
      },
      library: {
        open: vi.fn(),
      },
      learn: {
        enterHub: vi.fn(async () => {}),
        exitHub: vi.fn(),
        enterExercise: vi.fn(async () => {}),
        exitExercise: vi.fn(),
        enter: vi.fn(),
      },
      session: {
        resetInteractionState: vi.fn(),
        primeInteractiveAudio: vi.fn(),
      },
    },
    learnRuntime: {
      createPlayAlongPageRuntime: vi.fn(() => makePlayAlongRuntime()),
      createExercisePageRuntime: vi.fn((_options: CreateExercisePageRuntimeOptions) =>
        makeExerciseRuntime(),
      ),
    },
  }
}

function applyOverrides(base: AppCtxValue, overrides?: DeepPartialCtx): AppCtxValue {
  if (!overrides) return base
  const { actions: actionOverrides, learnRuntime: learnRuntimeOverrides, ...rest } = overrides
  const merged: AppCtxValue = { ...base, ...rest } as AppCtxValue
  if (actionOverrides) {
    merged.actions = {
      ...base.actions,
      ...actionOverrides,
      navigation: { ...base.actions.navigation, ...actionOverrides.navigation },
      home: { ...base.actions.home, ...actionOverrides.home },
      play: { ...base.actions.play, ...actionOverrides.play },
      live: { ...base.actions.live, ...actionOverrides.live },
      library: { ...base.actions.library, ...actionOverrides.library },
      learn: { ...base.actions.learn, ...actionOverrides.learn },
      session: { ...base.actions.session, ...actionOverrides.session },
    }
  }
  if (learnRuntimeOverrides) {
    merged.learnRuntime = { ...base.learnRuntime, ...learnRuntimeOverrides }
  }
  return merged
}

export type DeepPartialCtx = Partial<Omit<AppCtxValue, 'actions' | 'learnRuntime'>> & {
  actions?: Partial<AppCtxValue['actions']> & {
    navigation?: Partial<AppCtxValue['actions']['navigation']>
    home?: Partial<AppCtxValue['actions']['home']>
    play?: Partial<AppCtxValue['actions']['play']>
    live?: Partial<AppCtxValue['actions']['live']>
    library?: Partial<AppCtxValue['actions']['library']>
    learn?: Partial<AppCtxValue['actions']['learn']>
    session?: Partial<AppCtxValue['actions']['session']>
  }
  learnRuntime?: Partial<AppCtxValue['learnRuntime']>
}

export type RenderWithAppResult = ReturnType<typeof render> & { ctx: AppCtxValue }

export function renderWithApp(
  ui: () => JSX.Element,
  overrides?: DeepPartialCtx,
): RenderWithAppResult {
  const ctx = applyOverrides(makeFakeCtx(), overrides)
  const result = render(() => <AppCtx.Provider value={ctx}>{ui()}</AppCtx.Provider>)
  return Object.assign(result, { ctx })
}
