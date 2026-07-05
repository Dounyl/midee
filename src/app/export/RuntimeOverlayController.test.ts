import { describe, expect, it, vi } from 'vitest'

vi.mock('../../audio/SynthEngine', () => ({
  INSTRUMENTS: [{ id: 'upright', nameKey: 'instrument.upright' }],
}))

import { RuntimeOverlayController } from './RuntimeOverlayController'

describe('RuntimeOverlayController', () => {
  it('opens a recorded session in file mode and clears the pending session', async () => {
    const close = vi.fn()
    const loadSessionMidi = vi.fn()
    const pendingSessionRef = {
      current: {
        duration: 2,
        events: [
          { type: 'on' as const, pitch: 60, velocity: 0.8, time: 0 },
          { type: 'off' as const, pitch: 60, velocity: 0, time: 1 },
        ],
      },
    }

    const controller = new RuntimeOverlayController({
      services: {
        clock: { currentTime: 0 },
        synth: { setInstrument: vi.fn() },
      } as never,
      store: {
        state: { loadedMidi: null },
        replaceLoadedMidi: vi.fn(),
      } as never,
      renderer: {
        setPitchLabelsVisible: vi.fn(),
        setTheme: vi.fn(),
        setParticleStyle: vi.fn(),
        isTrackVisible: vi.fn(() => true),
        loadMidi: vi.fn(),
      } as never,
      persistence: {
        themeIndex: { save: vi.fn(), load: vi.fn(() => 0) },
        instrumentIndex: { save: vi.fn(), load: vi.fn(() => 0) },
        particleIndex: { save: vi.fn(), load: vi.fn(() => 0) },
        metronomeBpm: { save: vi.fn(), load: vi.fn(() => 120) },
        chordOverlay: { save: vi.fn(), load: vi.fn(() => false) },
        pitchLabels: { save: vi.fn(), load: vi.fn(() => true) },
        skipHomeIntro: { save: vi.fn(), load: vi.fn(() => false) },
      },
      ensureLearnController: vi.fn(),
      keyboardMode: {
        getMode: vi.fn(() => '88'),
        ensureMidiFitsCurrentMode: vi.fn(() => true),
      } as never,
      primeInteractiveAudio: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      resetPlaybackTelemetry: vi.fn(),
      closeTransientOverlays: vi.fn(),
      modals: {
        exportHandle: { get: vi.fn(), peek: vi.fn() },
        postSessionHandle: { get: vi.fn(), peek: vi.fn(() => ({ close })) },
        midiPickerHandle: { get: vi.fn(), peek: vi.fn() },
      } as never,
      ui: {
        chordVisible: false,
        renderTrackPanel: vi.fn(),
        updateConsoleState: vi.fn(),
        setChord: vi.fn(),
        setChordVisible: vi.fn(),
        updateChord: vi.fn(),
        setTheme: vi.fn(),
        setInstrumentLabel: vi.fn(),
        setCurrentInstrument: vi.fn(),
        setParticle: vi.fn(),
      } as never,
      state: {
        baseMidi: null,
        transposeSemitones: 0,
        pitchLabelsVisible: true,
        chordOverlayOn: false,
        currentThemeIndex: 0,
        currentInstrumentIndex: 0,
        currentParticleIndex: 0,
      },
      liveNotes: { heldNotes: new Map() },
      loopNotes: { heldNotes: new Map() },
      liveLooper: { snapshot: vi.fn(), layerCount: { value: 0 } },
      sessionRec: { recording: { value: false }, start: vi.fn(), stop: vi.fn() },
      pendingSessionRef,
      loadSessionMidi,
      metronomeBpm: () => 120,
      isTransposeEnabled: () => false,
      getLearnConsoleState: () => null,
    })

    await controller.handleSessionAction('open-in-file')

    expect(close).toHaveBeenCalledOnce()
    expect(loadSessionMidi).toHaveBeenCalledOnce()
    expect(pendingSessionRef.current).toBeNull()
  })
})
