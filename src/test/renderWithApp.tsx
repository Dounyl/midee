import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { vi } from 'vitest'
import type { AppServices } from '../core/services'
import { AppCtx, type AppCtxValue } from '../store/AppCtx'
import { createAppStore } from '../store/state'

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
      mode: {
        request: vi.fn(),
        mount: vi.fn(),
      },
      library: {
        open: vi.fn(),
      },
      learn: {
        mount: vi.fn(async () => {}),
        exit: vi.fn(),
        enter: vi.fn(),
      },
      session: {
        resetInteractionState: vi.fn(),
        primeInteractiveAudio: vi.fn(),
      },
    },
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
      mode: { ...base.actions.mode, ...actionOverrides.mode },
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
    mode?: Partial<AppCtxValue['actions']['mode']>
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
