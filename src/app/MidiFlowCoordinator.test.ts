import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '../store/state'
import { applyModeRequest } from './applyModeRequest'

describe('applyModeRequest', () => {
  it('opens the play landing when play is requested before any MIDI is loaded', () => {
    const store = createAppStore()
    const enterLiveMode = vi.fn()
    const enterPlayMode = vi.fn()

    applyModeRequest(store, 'play', {
      ensureLearnController: () =>
        Promise.resolve({
          closeActiveExercise: vi.fn(),
        }),
      enterLiveMode,
      enterPlayMode,
    })

    expect(store.state.mode).toBe('play')
    expect(store.state.status).toBe('idle')
    expect(store.state.loadedMidi).toBeNull()
    expect(enterLiveMode).not.toHaveBeenCalled()
    expect(enterPlayMode).not.toHaveBeenCalled()
  })

  it('reuses the existing play-mode transition when a MIDI is already loaded', () => {
    const store = createAppStore()
    store.completePlayLoad({
      name: 'demo.mid',
      duration: 12,
      bpm: 120,
      timeSignature: [4, 4],
      keySignature: null,
      tracks: [],
    })
    store.enterLive()
    const enterPlayMode = vi.fn(() => {
      store.enterPlay()
    })

    applyModeRequest(store, 'play', {
      ensureLearnController: () =>
        Promise.resolve({
          closeActiveExercise: vi.fn(),
        }),
      enterLiveMode: vi.fn(),
      enterPlayMode,
    })

    expect(enterPlayMode).toHaveBeenCalledOnce()
    expect(store.state.mode).toBe('play')
    expect(store.state.loadedMidi?.name).toBe('demo.mid')
  })
})
