import { describe, expect, it, vi } from 'vitest'
import { LiveNoteStore } from '@/services/midi/LiveNoteStore'
import { PlaybackCoordinator } from './PlaybackCoordinator'

function makeCoordinator(route: { kind: 'play' | 'live' | 'exercise' }) {
  const liveNotes = new LiveNoteStore()
  const loopNotes = new LiveNoteStore()
  const releaseAllSpy = vi.spyOn(liveNotes, 'releaseAll')
  const releaseSpy = vi.spyOn(liveNotes, 'release')
  const resetSpy = vi.spyOn(liveNotes, 'reset')
  const performanceBus = {
    forceReleaseAll: vi.fn(),
    routeNoteOn: vi.fn(),
    routeNoteOff: vi.fn(),
  }
  const opts = {
    store: {
      state: { status: 'playing' as const },
      setState: vi.fn(),
    },
    clock: {
      currentTime: 12,
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
    },
    synth: {
      liveNoteOn: vi.fn(),
      liveNoteOff: vi.fn(),
      liveReleaseAll: vi.fn(),
      scheduleNoteOn: vi.fn(),
      scheduleNoteOff: vi.fn(),
      audioContextTime: 0,
      pause: vi.fn(),
      seek: vi.fn(),
    },
    renderer: {
      burstParticleAt: vi.fn(),
    },
    liveNotes,
    loopNotes,
    liveLooper: {
      clear: vi.fn(),
      layerCount: { value: 0 },
    },
    sessionRec: {
      cancel: vi.fn(),
    },
    metronome: {
      stop: vi.fn(),
    },
    capture: {
      captureNoteOn: vi.fn(),
      captureNoteOff: vi.fn(),
    },
    performanceBus,
    getCurrentTarget: () => route,
    enterLiveMode: vi.fn(),
    closeTransientOverlays: vi.fn(),
  }
  return {
    coordinator: new PlaybackCoordinator(
      opts as unknown as ConstructorParameters<typeof PlaybackCoordinator>[0],
    ),
    opts,
    liveNotes: { store: liveNotes, releaseAllSpy, releaseSpy, resetSpy },
    performanceBus,
  }
}

describe('PlaybackCoordinator', () => {
  it('releases live-note highlights on note-off even on learn routes', () => {
    const { coordinator, liveNotes, performanceBus } = makeCoordinator({
      kind: 'exercise',
    })

    coordinator.handleLiveNoteOff({
      pitch: 60,
      velocity: 0,
      clockTime: 4,
      source: 'keyboard',
    })

    expect(performanceBus.routeNoteOff).toHaveBeenCalledWith({
      pitch: 60,
      velocity: 0,
      clockTime: 4,
      source: 'keyboard',
    })
    expect(liveNotes.releaseSpy).toHaveBeenCalledWith(60, 4)
  })

  it('emits particles only on capture routes while still releasing the key everywhere', () => {
    const play = makeCoordinator({ kind: 'play' })
    play.coordinator.handleLiveNoteOn({
      pitch: 64,
      velocity: 0.9,
      clockTime: 2,
      source: 'keyboard',
    })
    expect(play.opts.renderer.burstParticleAt).toHaveBeenCalledWith(64)

    const learn = makeCoordinator({ kind: 'exercise' })
    learn.coordinator.handleLiveNoteOn({
      pitch: 64,
      velocity: 0.9,
      clockTime: 2,
      source: 'keyboard',
    })
    expect(learn.opts.renderer.burstParticleAt).not.toHaveBeenCalled()
  })
})
