import { describe, expect, it, vi } from 'vitest'
import type { RouteTarget } from '@/stores/routing/routeTarget'

vi.mock('@/services/audio/SynthEngine', () => ({
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
        metronome: { bpm: { value: 120 } },
        renderer: {
          setPitchLabelsVisible: vi.fn(),
          setTheme: vi.fn(),
          setParticleStyle: vi.fn(),
          isTrackVisible: vi.fn(() => true),
          loadMidi: vi.fn(),
        },
        input: {} as never,
        keyboardMode: {
          getMode: vi.fn(() => '88'),
          ensureMidiFitsCurrentMode: vi.fn(() => true),
        },
        primeInteractiveAudio: vi.fn(),
      } as never,
      playbackSession: {
        state: { loadedMidi: null },
        replaceLoadedMidi: vi.fn(),
        setState: vi.fn(),
        hasLoadedFile: false,
        enterHome: vi.fn(),
        enterPlayLanding: vi.fn(),
        beginPlayLoad: vi.fn(),
        completePlayLoad: vi.fn(),
        enterPlay: vi.fn(),
        enterLive: vi.fn(),
      } as never,
      displayPrefs: {
        baseMidi: null,
        transposeSemitones: 0,
        pitchLabelsVisible: true,
        chordOverlayOn: false,
        currentThemeIndex: 0,
        currentInstrumentIndex: 0,
        currentParticleIndex: 0,
        saveThemeIndex: vi.fn(),
        saveInstrumentIndex: vi.fn(),
        saveParticleIndex: vi.fn(),
        saveChordOverlay: vi.fn(),
        savePitchLabels: vi.fn(),
      },
      learnRuntimeRegistry: {
        getConsoleStateProvider: vi.fn(() => null),
        getTransposeAwareRuntime: vi.fn(() => null),
      } as never,
      navigation: {
        getCurrentTarget: vi.fn((): RouteTarget | null => ({ kind: 'play' })),
        navigate: vi.fn(),
        enterLive: vi.fn(),
      },
      ui: {
        showLoading: vi.fn(),
        hideLoading: vi.fn(),
        showError: vi.fn(),
        showSuccess: vi.fn(),
        closeTransientOverlays: vi.fn(),
        openExportModal: vi.fn(),
        peekExportModal: vi.fn(),
        openPostSession: vi.fn(),
        closePostSession: close,
        openMidiPicker: vi.fn(),
        closeMidiPicker: vi.fn(),
        renderTrackPanel: vi.fn(),
        closeTrackPanel: vi.fn(),
        hideDropzone: vi.fn(),
        showDropzone: vi.fn(),
        setLearnFileName: vi.fn(),
        updateConsoleState: vi.fn(),
        closeConsole: vi.fn(),
        setChord: vi.fn(),
        setChordVisible: vi.fn(),
        updateChord: vi.fn(),
        isChordVisible: vi.fn(() => false),
        setTheme: vi.fn(),
        setInstrumentLabel: vi.fn(),
        setCurrentInstrument: vi.fn(),
        setParticle: vi.fn(),
      } as never,
      liveNotes: { heldNotes: new Map() },
      loopNotes: { heldNotes: new Map() },
      liveLooper: { snapshot: vi.fn(), layerCount: { value: 0 } },
      sessionRec: { recording: { value: false }, start: vi.fn(), stop: vi.fn() },
      pendingSessionRef,
      loadSessionMidi,
    })

    await controller.handleSessionAction('open-in-file')

    expect(close).toHaveBeenCalledOnce()
    expect(loadSessionMidi).toHaveBeenCalledOnce()
    expect(pendingSessionRef.current).toBeNull()
  })
})
