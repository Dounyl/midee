import { describe, expect, it, vi } from 'vitest'
import { createRuntimeEffectsOptions } from '@/app/runtime/runtimeEffectOptions'

describe('createRuntimeEffectsOptions', () => {
  it('returns the grouped effects options without widening dependencies', () => {
    const ui = { id: 'ui' }
    const route = {
      currentTarget: vi.fn(),
      currentTelemetryMode: vi.fn(),
      syncConsolePanel: vi.fn(),
      applyChordOverlayVisibility: vi.fn(),
      handleLoadedMidiChange: vi.fn(),
    }
    const playback = {
      store: { id: 'store' },
      clock: { id: 'clock' },
      synth: { id: 'synth' },
      liveLooper: { id: 'liveLooper' },
      metronome: { id: 'metronome' },
      sessionRec: { id: 'sessionRec' },
      onTrackLoopTransition: vi.fn(),
      onResetLiveNotes: vi.fn(),
      onMaybeUpdateChordOverlay: vi.fn(),
      onFirstPlaybackMilestone: vi.fn(),
      onSpeedChange: vi.fn(),
      playbackMilestones: new Set<number>(),
      firstPlayLoggedRef: { current: false },
      applyInstrumentLoading: vi.fn(),
    }
    const midi = {
      input: { id: 'midiInput' },
    }

    const options = createRuntimeEffectsOptions({
      ui: ui as never,
      route: route as never,
      playback: playback as never,
      midi: midi as never,
    })

    expect(options.ui).toBe(ui)
    expect(options.route).toBe(route)
    expect(options.playback).toBe(playback)
    expect(options.midi).toBe(midi)
  })
})
