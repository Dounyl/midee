import { describe, expect, it } from 'vitest'
import type { MidiFile } from '@/types/midi/types'
import { createEventSignal } from './eventSignal'
import { createAppStore, resolveInitialAppMode, SKIP_HOME_INTRO_STORAGE_KEY } from './state'
import { watch } from './watch'

function fakeMidi(name = 'demo.mid', duration = 12.5): MidiFile {
  return { name, duration, bpm: 120, timeSignature: [4, 4], keySignature: null, tracks: [] }
}

describe('createEventSignal', () => {
  it('exposes the initial value', () => {
    const s = createEventSignal(42)
    expect(s.value).toBe(42)
  })

  it('set() updates the value and notifies subscribers', () => {
    const s = createEventSignal('a')
    const seen: string[] = []
    s.subscribe((v) => seen.push(v))
    s.set('b')
    s.set('c')
    expect(s.value).toBe('c')
    expect(seen).toEqual(['b', 'c'])
  })

  it('unsubscribe stops future notifications', () => {
    const s = createEventSignal(0)
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    s.set(1)
    off()
    s.set(2)
    expect(seen).toEqual([1])
  })
})

describe('createAppStore', () => {
  it('starts idle with no MIDI loaded', () => {
    const store = createAppStore()
    expect(store.state.status).toBe('idle')
    expect(store.state.loadedMidi).toBeNull()
    expect(store.hasLoadedFile).toBe(false)
    expect(store.state.currentTime).toBe(0)
  })

  it('enterHome clears the loaded MIDI and resets the transport', () => {
    const store = createAppStore()
    store.completePlayLoad(fakeMidi())
    store.setState('currentTime', 4.2)
    store.setState('status', 'playing')
    store.enterHome()
    expect(store.state.loadedMidi).toBeNull()
    expect(store.state.duration).toBe(0)
    expect(store.state.currentTime).toBe(0)
    expect(store.state.status).toBe('idle')
  })

  it('enterPlayLanding opens the play surface without requiring a MIDI', () => {
    const store = createAppStore()
    store.enterPlayLanding()
    expect(store.state.status).toBe('idle')
    expect(store.state.loadedMidi).toBeNull()
    expect(store.state.duration).toBe(0)
    expect(store.state.currentTime).toBe(0)
  })

  it('completePlayLoad stores the MIDI and flips to ready', () => {
    const store = createAppStore()
    const midi = fakeMidi('song.mid', 20)
    store.beginPlayLoad()
    expect(store.state.status).toBe('loading')
    store.completePlayLoad(midi)
    expect(store.state.loadedMidi?.name).toBe(midi.name)
    expect(store.state.duration).toBe(20)
    expect(store.state.status).toBe('ready')
    expect(store.hasLoadedFile).toBe(true)
  })

  it('enterPlay no-ops when no MIDI is loaded', () => {
    const store = createAppStore()
    expect(store.enterPlay()).toBe(false)
    expect(store.state.status).toBe('idle')
  })

  it('enterPlay restores ready runtime state when a MIDI is loaded', () => {
    const store = createAppStore()
    const midi = fakeMidi()
    store.completePlayLoad(midi)
    store.enterLive()
    expect(store.state.status).toBe('ready')
    expect(store.enterPlay()).toBe(true)
    expect(store.state.status).toBe('ready')
    expect(store.state.loadedMidi?.name).toBe(midi.name)
  })

  it('enterPlay(false) preserves the current playhead for resume', () => {
    const store = createAppStore()
    store.completePlayLoad(fakeMidi())
    store.setState('currentTime', 7.5)
    store.enterLive(false)
    store.enterPlay(false)
    expect(store.state.currentTime).toBe(7.5)
  })

  it('play-mode loads only manipulate runtime playback state', () => {
    const store = createAppStore()
    store.beginPlayLoad()
    expect(store.state.status).toBe('loading')
    store.completePlayLoad(fakeMidi('play-import.mid', 10))
    expect(store.state.status).toBe('ready')
    expect(store.state.loadedMidi?.name).toBe('play-import.mid')
  })

  it('status transitions notify tracked effects in order', () => {
    const store = createAppStore()
    const seen: string[] = []
    const stop = watch(
      () => store.state.status,
      (s) => seen.push(s),
    )
    store.beginPlayLoad()
    store.completePlayLoad(fakeMidi())
    store.setState('status', 'playing')
    store.setState('status', 'paused')
    store.setState('status', 'ready')
    stop()
    expect(seen).toEqual(['loading', 'ready', 'playing', 'paused', 'ready'])
  })

  it('batch intent methods flip multiple fields in one reactive pass', () => {
    const store = createAppStore()
    store.completePlayLoad(fakeMidi())
    const snapshots: Array<{ hasFile: boolean; status: string }> = []
    const stop = watch(
      () => [store.state.loadedMidi !== null, store.state.status] as const,
      ([hasFile, status]) => snapshots.push({ hasFile, status }),
    )
    store.enterHome()
    stop()
    expect(snapshots.length).toBe(1)
    expect(snapshots[0]).toEqual({ hasFile: false, status: 'idle' })
  })
})

describe('resolveInitialAppMode', () => {
  it('prefers the current route over saved skip-home preference', () => {
    window.history.pushState({}, '', '/learn')
    localStorage.setItem(SKIP_HOME_INTRO_STORAGE_KEY, 'true')
    expect(resolveInitialAppMode()).toBe('learn')
    window.history.pushState({}, '', '/')
  })

  it('starts on play when skip-home-intro is enabled', () => {
    window.history.pushState({}, '', '/welcome')
    localStorage.setItem(SKIP_HOME_INTRO_STORAGE_KEY, 'true')
    expect(resolveInitialAppMode()).toBe('play')
    window.history.pushState({}, '', '/')
  })

  it('falls back to home when the preference is absent', () => {
    window.history.pushState({}, '', '/welcome')
    localStorage.removeItem(SKIP_HOME_INTRO_STORAGE_KEY)
    expect(resolveInitialAppMode()).toBe('home')
    window.history.pushState({}, '', '/')
  })
})

describe('watch()', () => {
  it('fires the callback on change and stops after dispose', () => {
    const store = createAppStore()
    const seen: string[] = []
    const stop = watch(
      () => store.state.status,
      (status) => seen.push(status),
    )
    store.setState('status', 'loading')
    store.setState('status', 'ready')
    stop()
    store.setState('status', 'playing')
    expect(seen).toEqual(['loading', 'ready'])
  })
})
