import { describe, expect, it, vi } from 'vitest'
import { AppApplicationController } from '@/app/runtime/AppApplicationController'
import { createLearnState } from '@/features/learn/core/LearnState'
import type {
  LearnRuntimeHandle,
  PlayAlongPreparedMidiConsumer,
} from '@/features/learn/runtime/types'
import type { LearnRuntimeRegistryPort } from '@/services/runtime/contracts'
import { createEventSignal } from '@/stores/app/eventSignal'
import type { RouteTarget } from '@/stores/routing/routeTarget'

function createController() {
  const files = {
    openFilePicker: vi.fn(),
    openSample: vi.fn(async () => {}),
    openLocalMidi: vi.fn(async () => {}),
    enterLearn: vi.fn(async () => {}),
  }
  const navigation = {
    getCurrentTarget: vi.fn((): RouteTarget | null => ({ kind: 'play' })),
    navigate: vi.fn(),
    enterLive: vi.fn(),
  }
  const learnRuntimeRegistry: LearnRuntimeRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    getActiveRuntime: vi.fn<() => LearnRuntimeHandle | null>(() => null),
    getConsoleStateProvider: vi.fn(() => null),
    getMidiBackedRuntime: vi.fn(() => null),
    getTransposeAwareRuntime: vi.fn(() => null),
    getPreparedMidiConsumer: vi.fn<() => PlayAlongPreparedMidiConsumer | null>(() => null),
    stagePreparedPlayAlongMidi: vi.fn(),
    consumePreparedPlayAlongMidi: vi.fn(() => null),
  }
  const ui = {
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    closeTransientOverlays: vi.fn(),
    openExportModal: vi.fn(async () => {}),
    peekExportModal: vi.fn(() => null),
    openPostSession: vi.fn(async () => {}),
    closePostSession: vi.fn(),
    openMidiPicker: vi.fn(async () => {}),
    closeMidiPicker: vi.fn(),
    renderTrackPanel: vi.fn(),
    closeTrackPanel: vi.fn(),
    hideDropzone: vi.fn(),
    showDropzone: vi.fn(),
    setLearnFileName: vi.fn(),
    updateConsoleState: vi.fn(),
    closeConsole: vi.fn(),
    setTheme: vi.fn(),
    setParticle: vi.fn(),
    setChord: vi.fn(),
    setChordVisible: vi.fn(),
    updateChord: vi.fn(),
    isChordVisible: vi.fn(() => false),
    setInstrumentLabel: vi.fn(),
    setCurrentInstrument: vi.fn(),
  }
  const controller = new AppApplicationController({
    services: {
      clock: { pause: vi.fn(), seek: vi.fn() },
      synth: {} as never,
      metronome: {} as never,
      renderer: { clearMidi: vi.fn(), setLiveNotesVisible: vi.fn(), setVisible: vi.fn() },
      input: {} as never,
      keyboardMode: {} as never,
      primeInteractiveAudio: vi.fn(),
    } as never,
    ui: ui as never,
    navigation,
    learnRuntimeRegistry: learnRuntimeRegistry as never,
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
    playbackSession: {
      state: {
        loadedMidi: null,
        status: 'idle',
        currentTime: 0,
        duration: 0,
        volume: 1,
        speed: 1,
      },
      setState: vi.fn(),
      setStatus: vi.fn(),
      hasLoadedFile: false,
      enterPlayLanding: vi.fn(),
      beginPlayLoad: vi.fn(),
      completePlayLoad: vi.fn(),
      replaceLoadedMidi: vi.fn(),
      enterPlay: vi.fn(() => false),
      enterLive: vi.fn(),
    },
    keyboardInput: { enable: vi.fn() },
    fileFlows: files,
    resetInteractionState: vi.fn(),
    syncConsolePanel: vi.fn(),
  })

  return { controller, files, navigation, learnRuntimeRegistry, ui }
}

describe('AppApplicationController', () => {
  it('routes library requests without leaking branching into callers', async () => {
    const { controller, files } = createController()

    controller.openLibraryRequest({ kind: 'picker', target: 'learn' })
    await controller.openLibraryRequest({
      kind: 'recent',
      target: 'learn',
      entry: { kind: 'sample', id: 'demo' },
    })
    await controller.openLibraryRequest({
      kind: 'recent',
      target: 'play',
      entry: { kind: 'local', id: 'song-1' },
    })

    expect(files.openFilePicker).toHaveBeenCalledWith('learn')
    expect(files.enterLearn).toHaveBeenCalledWith({ kind: 'sample', sampleId: 'demo' })
    expect(files.openLocalMidi).toHaveBeenCalledWith('song-1', 'play')
  })

  it('stages prepared midi and navigates when play-along is not active', async () => {
    const { controller, navigation, learnRuntimeRegistry } = createController()
    const midi = {
      name: 'prepared',
      duration: 1,
      bpm: 120,
      timeSignature: [4, 4] as [number, number],
      tracks: [],
    }

    await controller.openPreparedPlayAlong(midi)

    expect(learnRuntimeRegistry.stagePreparedPlayAlongMidi).toHaveBeenCalledWith(midi)
    expect(navigation.navigate).toHaveBeenCalledWith({ kind: 'exercise', routeId: 'play-along' })
  })

  it('loads prepared midi directly into an active play-along runtime', async () => {
    const { controller, navigation, learnRuntimeRegistry } = createController()
    const loadPreparedMidi = vi.fn(async () => {})
    const activeRuntime = {
      routeId: 'play-along' as const,
      learnState: createLearnState(),
      view: createEventSignal<'page' | 'exercise'>('page'),
      enter: vi.fn(),
      exit: vi.fn(),
      startPlayAlong: vi.fn(async () => {}),
      loadPreparedMidi,
      getConsoleState: vi.fn(() => ({ enabled: false, baseKey: null, current: 0 })),
      setTranspose: vi.fn(),
      getLoadedMidi: vi.fn(() => null),
    }
    const midi = {
      name: 'prepared',
      duration: 1,
      bpm: 120,
      timeSignature: [4, 4] as [number, number],
      tracks: [],
    }
    learnRuntimeRegistry.getActiveRuntime = vi.fn(() => activeRuntime)
    learnRuntimeRegistry.getPreparedMidiConsumer = vi.fn(() => activeRuntime)

    await controller.openPreparedPlayAlong(midi)

    expect(loadPreparedMidi).toHaveBeenCalledWith(midi)
    expect(learnRuntimeRegistry.stagePreparedPlayAlongMidi).not.toHaveBeenCalled()
    expect(navigation.navigate).not.toHaveBeenCalled()
  })
})
