import { batch } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import type { MidiFile } from '../core/midi/types'
import { pathToMode, resolveInitialRoutePath } from '../routing/modeRoutes'

export type AppMode = 'home' | 'play' | 'live' | 'learn'
export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'exporting'

export const SKIP_HOME_INTRO_STORAGE_KEY = 'midee.skipHomeIntro'

export interface AppStoreState {
  status: PlaybackStatus
  loadedMidi: MidiFile | null
  currentTime: number
  duration: number
  volume: number
  speed: number
}

interface AppStoreBase {
  state: AppStoreState
  setState: SetStoreFunction<AppStoreState>
  readonly hasLoadedFile: boolean
}

export interface AppPublicStore extends AppStoreBase {}

export interface AppRuntimeStore extends AppStoreBase {
  enterHome(): void
  enterPlayLanding(): void
  beginPlayLoad(): void
  completePlayLoad(midi: MidiFile): void
  replaceLoadedMidi(midi: MidiFile): void
  enterPlay(resetTime?: boolean): boolean
  enterLive(resetTime?: boolean): void
}

export function resolveInitialAppMode(): AppMode {
  try {
    const initialPath = resolveInitialRoutePath(
      window.location.pathname,
      localStorage.getItem(SKIP_HOME_INTRO_STORAGE_KEY) === 'true',
    )
    return pathToMode(initialPath) ?? 'home'
  } catch {
    return 'home'
  }
}

// The AppStore is the single source of truth for mode transitions, playback
// status, and the loaded MIDI. Consumers read `store.state.foo` (reactive
// inside a tracking scope, raw value outside) and write either through an
// intent method (multi-field, batched) or directly via `store.setState`.
export function createAppStore(): AppRuntimeStore {
  const [state, setState] = createStore<AppStoreState>({
    status: 'idle',
    loadedMidi: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    speed: 1,
  })

  return {
    state,
    setState,
    // Multi-field transitions only — single-field writes go through setState.
    enterHome() {
      batch(() => {
        setState({
          status: 'idle',
          loadedMidi: null,
          duration: 0,
          currentTime: 0,
        })
      })
    },
    enterPlayLanding() {
      batch(() => {
        setState({
          status: 'idle',
          loadedMidi: null,
          duration: 0,
          currentTime: 0,
        })
      })
    },
    beginPlayLoad() {
      batch(() => {
        setState({ status: 'loading', currentTime: 0 })
      })
    },
    completePlayLoad(m: MidiFile) {
      batch(() => {
        setState({
          loadedMidi: m,
          duration: m.duration,
          currentTime: 0,
          status: 'ready',
        })
      })
    },
    replaceLoadedMidi(m: MidiFile) {
      batch(() => {
        setState({
          loadedMidi: m,
          duration: m.duration,
        })
      })
    },
    // Re-entry into Play mode without reloading MIDI — e.g. switching back
    // from Live or recovering from a failed load. Returns false when no MIDI
    // is loaded so the caller can fall back to the file picker.
    enterPlay(resetTime = true): boolean {
      if (state.loadedMidi === null) return false
      batch(() => {
        setState({
          status: 'ready',
          duration: state.loadedMidi!.duration,
          ...(resetTime ? { currentTime: 0 } : {}),
        })
      })
      return true
    },
    enterLive(resetTime = true) {
      batch(() => {
        setState({
          status: 'ready',
          ...(resetTime ? { currentTime: 0 } : {}),
        })
      })
    },
    get hasLoadedFile(): boolean {
      return state.loadedMidi !== null
    },
  }
}

export type AppStore = AppRuntimeStore
