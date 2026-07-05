import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { vi } from 'vitest'
import { AppCtx, type AppCtxValue } from '@/stores/app/AppCtx'
import { createAppStore } from '@/stores/app/state'
import type { AppServices } from '../core/services'
import type { LearnController } from '../modes/LearnController'

function fakeRenderer(): AppServices['renderer'] {
  return {
    clearMidi: vi.fn(),
    loadMidi: vi.fn(),
    setVisible: vi.fn(),
    setLiveNotesVisible: vi.fn(),
  } as unknown as AppServices['renderer']
}

function fakeServices(): AppServices {
  const store = createAppStore()
  return {
    store,
    clock: null as never,
    synth: null as never,
    metronome: null as never,
    renderer: fakeRenderer(),
    input: null as never,
  }
}

function makeFakeCtx(): AppCtxValue {
  const services = fakeServices()
  return {
    services,
    store: services.store,
    actions: {
      navigation: {
        toMode: vi.fn(),
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
        enterRoute: vi.fn(async () => {}),
        exitRoute: vi.fn(),
        enter: vi.fn(),
      },
      session: {
        resetInteractionState: vi.fn(),
        primeInteractiveAudio: vi.fn(),
      },
    },
    ensureLearnController: vi.fn(async () => ({
      learnState: {
        state: {
          loadedMidi: null,
          currentTime: 0,
          duration: 0,
          status: 'idle',
          transportWanted: false,
        },
      },
      startPlayAlong: vi.fn(),
    })) as unknown as () => Promise<LearnController>,
  }
}

function applyOverrides(base: AppCtxValue, overrides?: DeepPartialCtx): AppCtxValue {
  if (!overrides) return base
  const { services: serviceOverrides, actions: actionOverrides, ...rest } = overrides
  const merged: AppCtxValue = { ...base, ...rest } as AppCtxValue
  if (serviceOverrides) {
    merged.services = { ...base.services, ...serviceOverrides }
    if (serviceOverrides.store) merged.store = serviceOverrides.store
  }
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
  return merged
}

export type DeepPartialCtx = Partial<Omit<AppCtxValue, 'services' | 'actions'>> & {
  services?: Partial<AppServices>
  actions?: Partial<AppCtxValue['actions']> & {
    navigation?: Partial<AppCtxValue['actions']['navigation']>
    home?: Partial<AppCtxValue['actions']['home']>
    play?: Partial<AppCtxValue['actions']['play']>
    live?: Partial<AppCtxValue['actions']['live']>
    library?: Partial<AppCtxValue['actions']['library']>
    learn?: Partial<AppCtxValue['actions']['learn']>
    session?: Partial<AppCtxValue['actions']['session']>
  }
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
