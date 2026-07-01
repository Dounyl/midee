import { createContext, useContext } from 'solid-js'
import type { AppServices } from '../core/services'
import type { AppMode, AppStore } from './state'

export interface ModeMountOptions {
  skipAnalytics?: boolean
}

export type ShellMode = Exclude<AppMode, 'learn'>

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
  mode: {
    request(mode: AppMode): void
    mount(mode: ShellMode, options?: ModeMountOptions): void
  }
  library: {
    open(request: LibraryOpenRequest): Promise<void> | void
  }
  learn: {
    mount(signal?: AbortSignal): Promise<void>
    exit(): void
    enter(request: LearnEnterRequest): Promise<void> | void
  }
  session: {
    resetInteractionState(): void
    primeInteractiveAudio(): void
  }
}

// Context value threaded via `<AppCtx.Provider value={ctx}>`. Mode shells and
// Solid components read app state from `services` / `store`, then express user
// intent exclusively through `actions`. Avoid exposing imperative UI handles or
// parallel entrypoints here — they create branching "which path do I change?"
// decisions that make follow-up work more expensive.
export interface AppCtxValue {
  services: AppServices
  store: AppStore
  actions: AppActions
}

export const AppCtx = createContext<AppCtxValue>()

export function useApp(): AppCtxValue {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp() called outside <AppCtx.Provider>')
  return v
}
