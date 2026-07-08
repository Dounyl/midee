import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/stores/app/state'

function createSignalMock<T>(initial: T) {
  const subs: Array<(value: T) => void> = []
  return {
    value: initial,
    subs,
    set(value: T) {
      this.value = value
      subs.forEach((fn) => {
        fn(value)
      })
    },
    subscribe(fn: (value: T) => void) {
      subs.push(fn)
      return vi.fn(() => {
        const index = subs.indexOf(fn)
        if (index >= 0) subs.splice(index, 1)
      })
    },
  }
}

const runtimeMocks = vi.hoisted(() => ({
  bootstrapRuntimeUi: vi.fn(),
  wireRuntimeEffects: vi.fn(),
  wireRuntimeInput: vi.fn(),
  createRuntimeCoordinators: vi.fn(),
  bindRuntimeDomEvents: vi.fn(),
  scheduleRuntimeWarmup: vi.fn(),
  installViewportClassSync: vi.fn(),
  navigateToTarget: vi.fn(),
  getCurrentRouteTarget: vi.fn(() => ({ kind: 'play' })),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  renderer: null as unknown,
  synth: null as unknown,
  clock: null as unknown,
  midiInput: null as unknown,
  keyboardInput: null as unknown,
  liveLooper: null as unknown,
  metronome: null as unknown,
  sessionRec: null as unknown,
  ui: {
    syncMidiStatus: vi.fn(),
    syncOctave: vi.fn(),
    setInstrumentMenuLoading: vi.fn(),
    toggleTrackPanel: vi.fn(),
    setLearnFileName: vi.fn(),
    dispose: vi.fn(),
  },
  playback: {
    releaseAllLiveNotes: vi.fn(),
    trackLoopTransition: vi.fn(),
    handleLiveNoteOn: vi.fn(),
    handleLiveNoteOff: vi.fn(),
    deferToCtxTime: vi.fn(),
    resetInteractionState: vi.fn(),
  },
  midiFlow: {
    openFile: vi.fn(async () => {}),
    openSample: vi.fn(async () => {}),
    openLocal: vi.fn(async () => {}),
    enterLearn: vi.fn(async () => {}),
    loadSessionMidi: vi.fn(),
  },
  exportOverlay: {
    syncConsolePanel: vi.fn(),
    applyChordOverlayVisibility: vi.fn(),
    applyTheme: vi.fn(),
    applyInstrument: vi.fn(),
    applyParticleStyle: vi.fn(),
    cycleTheme: vi.fn(),
    openExportModal: vi.fn(),
    handleTransposeChange: vi.fn(),
    cycleInstrument: vi.fn(),
    cycleParticleStyle: vi.fn(),
    saveLoopAsMidi: vi.fn(),
    toggleSessionRecord: vi.fn(),
    toggleChordOverlay: vi.fn(),
    setInstrumentById: vi.fn(),
    setThemeByIndex: vi.fn(),
    setParticleByIndex: vi.fn(),
    setPitchLabelsVisible: vi.fn(),
    maybeUpdateChordOverlay: vi.fn(),
    setInstrumentMenuLoading: vi.fn(),
    cancelExport: vi.fn(),
    startExport: vi.fn(),
    handleSessionAction: vi.fn(),
    loadSessionMidi: vi.fn(),
  },
  effectsUnsub: vi.fn(),
  inputUnsub: vi.fn(),
  domUnsub: vi.fn(),
}))

vi.mock('@/app/runtime/bootstrapUi', () => ({
  bootstrapRuntimeUi: runtimeMocks.bootstrapRuntimeUi,
}))

vi.mock('@/app/runtime/wireRuntimeEffects', () => ({
  wireRuntimeEffects: runtimeMocks.wireRuntimeEffects,
}))

vi.mock('@/app/runtime/wireRuntimeInput', () => ({
  wireRuntimeInput: runtimeMocks.wireRuntimeInput,
}))

vi.mock('@/app/runtime/runtimeCoordinators', () => ({
  createRuntimeCoordinators: runtimeMocks.createRuntimeCoordinators,
}))

vi.mock('@/app/runtime/runtimeDomEvents', () => ({
  bindRuntimeDomEvents: runtimeMocks.bindRuntimeDomEvents,
}))

vi.mock('@/app/runtime/warmup', () => ({
  scheduleRuntimeWarmup: runtimeMocks.scheduleRuntimeWarmup,
}))

vi.mock('@/components/common/utils', () => ({
  installViewportClassSync: runtimeMocks.installViewportClassSync,
}))

vi.mock('@/components/common/Toast', () => ({
  showError: runtimeMocks.showError,
  showSuccess: runtimeMocks.showSuccess,
}))

vi.mock('@/stores/routing/routerBridge', () => ({
  getCurrentRouteTarget: runtimeMocks.getCurrentRouteTarget,
  navigateToTarget: runtimeMocks.navigateToTarget,
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/services/telemetry', () => ({
  track: vi.fn(),
  trackEvent: vi.fn(),
  trackEventSettled: vi.fn(),
}))

vi.mock('@/app/runtime/preferences', () => ({
  createAppPreferences: () => ({
    hydrate: () => ({
      chordOverlay: false,
      pitchLabels: true,
      themeIndex: 0,
      instrumentIndex: 0,
      particleIndex: 0,
    }),
    stores: {
      themeIndex: { save: vi.fn() },
      instrumentIndex: { save: vi.fn() },
      particleIndex: { save: vi.fn() },
      chordOverlay: { save: vi.fn(), load: vi.fn(() => false) },
      pitchLabels: { save: vi.fn() },
      metronomeBpm: { save: vi.fn(), load: vi.fn(() => 120) },
      keyboardMode61: { save: vi.fn(), load: vi.fn(() => false) },
    },
  }),
}))

vi.mock('@/lib/lazyHandle', () => ({
  lazyHandle: () => ({
    get: vi.fn(async () => ({ open: vi.fn(), close: vi.fn() })),
    peek: vi.fn(() => null),
  }),
}))

vi.mock('@/lib/core/MasterClock', () => ({
  MasterClock: class {
    currentTime = 0
    speed = 1
    constructor() {
      runtimeMocks.clock = this
    }
    prime = vi.fn()
    play = vi.fn()
    pause = vi.fn()
    seek = vi.fn()
    dispose = vi.fn()
    subscribe = vi.fn(() => vi.fn())
  },
}))

vi.mock('@/services/renderer/PianoRollRenderer', () => ({
  PianoRollRenderer: class {
    constructor() {
      runtimeMocks.renderer = this
    }
    init = vi.fn(async () => {})
    attachClock = vi.fn()
    setLiveNoteStore = vi.fn()
    setLoopNoteStore = vi.fn()
    setPitchLabelsVisible = vi.fn()
    setKeyboardMode = vi.fn()
    setZoom = vi.fn()
    setVisible = vi.fn()
    setLiveNotesVisible = vi.fn()
    pitchAtClientPoint = vi.fn(() => 60)
    clearMidi = vi.fn()
    loadMidi = vi.fn()
    destroy = vi.fn()
  },
}))

vi.mock('@/services/audio/SynthEngine', () => ({
  SynthEngine: class {
    loadingInstrument = createSignalMock<string | null>(null)
    constructor() {
      runtimeMocks.synth = this
    }
    seek = vi.fn()
    preloadDefault = vi.fn()
    primeLiveInput = vi.fn()
    dispose = vi.fn()
    scheduleNoteOn = vi.fn()
    scheduleNoteOff = vi.fn()
    liveReleaseAll = vi.fn()
    setTrackEnabled = vi.fn()
    setSpeed = vi.fn()
    setVolume = vi.fn()
    load = vi.fn(async () => {})
  },
}))

vi.mock('@/services/input/InputBus', () => ({
  InputBus: class {
    noteOn = createSignalMock(null)
    noteOff = createSignalMock(null)
    emitNoteOn = vi.fn()
    emitNoteOff = vi.fn()
    emitPedal = vi.fn()
  },
}))

vi.mock('@/services/midi/LiveNoteStore', () => ({
  LiveNoteStore: class {
    press = vi.fn()
    release = vi.fn()
    releaseAll = vi.fn()
    reset = vi.fn()
  },
}))

vi.mock('@/services/audio/Metronome', () => ({
  Metronome: class {
    running = createSignalMock(false)
    bpm = createSignalMock(120)
    beatCount = createSignalMock(0)
    constructor() {
      runtimeMocks.metronome = this
    }
    toggle = vi.fn()
    setBpm = vi.fn()
    dispose = vi.fn()
  },
}))

vi.mock('@/services/midi/ComputerKeyboardInput', () => ({
  ComputerKeyboardInput: class {
    noteOn = createSignalMock(null)
    noteOff = createSignalMock(null)
    pedal = createSignalMock(false)
    octave = createSignalMock(0)
    constructor() {
      runtimeMocks.keyboardInput = this
    }
    enable = vi.fn()
    shiftOctaveUp = vi.fn()
    shiftOctaveDown = vi.fn()
    dispose = vi.fn()
  },
}))

vi.mock('@/services/midi/KeyboardModeCoordinator', () => ({
  KeyboardModeCoordinator: class {
    getMode = vi.fn(() => '88')
  },
}))

vi.mock('@/services/midi/LiveLooper', () => ({
  LiveLooper: class {
    state = createSignalMock<'idle' | 'playing'>('idle')
    layerCount = createSignalMock(0)
    progress = createSignalMock(0)
    constructor() {
      runtimeMocks.liveLooper = this
    }
    toggle = vi.fn()
    clear = vi.fn()
    undo = vi.fn()
    dispose = vi.fn()
  },
}))

vi.mock('@/services/midi/SessionRecorder', () => ({
  SessionRecorder: class {
    recording = createSignalMock(false)
    elapsed = createSignalMock(0)
    constructor() {
      runtimeMocks.sessionRec = this
    }
    captureNoteOn = vi.fn()
    captureNoteOff = vi.fn()
    dispose = vi.fn()
  },
}))

vi.mock('@/services/midi/CaptureFanout', () => ({
  CaptureFanout: class {
    captureNoteOff = vi.fn()
  },
}))

vi.mock('@/services/midi/MidiInputCoordinator', () => ({
  MidiInputCoordinator: class {
    status = createSignalMock<'disconnected' | 'blocked' | 'connected'>('disconnected')
    deviceName = createSignalMock('')
    noteOn = createSignalMock(null)
    noteOff = createSignalMock(null)
    pedal = createSignalMock(false)
    constructor() {
      runtimeMocks.midiInput = this
    }
    requestAccess = vi.fn(async () => true)
    dispose = vi.fn()
  },
}))

vi.mock('@/services/performance/LivePerformanceBus', () => ({
  createLivePerformanceBus: () => ({
    subscribeNotes: vi.fn(() => vi.fn()),
    routePedalDown: vi.fn(),
    routePedalUp: vi.fn(),
  }),
}))

vi.mock('@/app/runtime/learnRuntimeFactories', () => ({
  createPlayAlongRuntime: vi.fn(() => ({ routeId: 'play-along' })),
  createExerciseRuntime: vi.fn(() => ({ routeId: 'intervals' })),
}))

vi.mock('@/features/learn/runtime/ActiveLearnRuntimeRegistry', () => ({
  ActiveLearnRuntimeRegistry: class {
    register = vi.fn()
    unregister = vi.fn()
    getConsoleStateProvider = vi.fn(() => null)
    getMidiBackedRuntime = vi.fn(() => null)
    consumePreparedPlayAlongMidi = vi.fn(() => null)
    getActiveRuntime = vi.fn(() => null)
    getTransposeAwareRuntime = vi.fn(() => null)
    getPreparedMidiConsumer = vi.fn(() => null)
    stagePreparedPlayAlongMidi = vi.fn()
  },
}))

describe('AppRuntime composition root', () => {
  beforeEach(() => {
    runtimeMocks.bootstrapRuntimeUi.mockReset()
    runtimeMocks.wireRuntimeEffects.mockReset()
    runtimeMocks.wireRuntimeInput.mockReset()
    runtimeMocks.createRuntimeCoordinators.mockReset()
    runtimeMocks.bindRuntimeDomEvents.mockReset()
    runtimeMocks.scheduleRuntimeWarmup.mockReset()
    runtimeMocks.installViewportClassSync.mockReset()
    runtimeMocks.navigateToTarget.mockReset()
    runtimeMocks.getCurrentRouteTarget.mockReset()
    runtimeMocks.showError.mockReset()
    runtimeMocks.showSuccess.mockReset()
    runtimeMocks.effectsUnsub.mockReset()
    runtimeMocks.inputUnsub.mockReset()
    runtimeMocks.domUnsub.mockReset()
    runtimeMocks.ui.syncMidiStatus.mockReset()
    runtimeMocks.ui.dispose.mockReset()
    runtimeMocks.playback.releaseAllLiveNotes.mockReset()
    runtimeMocks.playback.resetInteractionState.mockReset()
    runtimeMocks.getCurrentRouteTarget.mockReturnValue({ kind: 'play' })

    runtimeMocks.bootstrapRuntimeUi.mockReturnValue({ ui: runtimeMocks.ui })
    runtimeMocks.wireRuntimeEffects.mockReturnValue([
      { label: 'effects', unsubs: [runtimeMocks.effectsUnsub] },
    ])
    runtimeMocks.wireRuntimeInput.mockReturnValue([
      { label: 'input', unsubs: [runtimeMocks.inputUnsub] },
    ])
    runtimeMocks.createRuntimeCoordinators.mockReturnValue({
      playback: runtimeMocks.playback,
      midiFlow: runtimeMocks.midiFlow,
      exportOverlay: runtimeMocks.exportOverlay,
    })
    runtimeMocks.bindRuntimeDomEvents.mockReturnValue(runtimeMocks.domUnsub)
  })

  it('assembles bootstrap/effects/input/coordinators and cleans them up on dispose', async () => {
    const { App } = await import('@/app/AppRuntime')
    const app = new App(createAppStore())
    const actions = await app.init(
      {
        canvas: document.createElement('canvas'),
        overlay: document.createElement('div'),
      },
      () => ({}) as never,
    )

    expect(actions).toEqual({})
    expect(runtimeMocks.installViewportClassSync).toHaveBeenCalledOnce()
    expect(runtimeMocks.bootstrapRuntimeUi).toHaveBeenCalledOnce()
    expect(runtimeMocks.createRuntimeCoordinators).toHaveBeenCalledOnce()
    expect(runtimeMocks.wireRuntimeEffects).toHaveBeenCalledOnce()
    expect(runtimeMocks.wireRuntimeInput).toHaveBeenCalledOnce()
    expect(runtimeMocks.bindRuntimeDomEvents).toHaveBeenCalledOnce()
    expect(runtimeMocks.scheduleRuntimeWarmup).toHaveBeenCalledOnce()

    const bootstrapOptions = runtimeMocks.bootstrapRuntimeUi.mock.calls[0]?.[0]
    expect(bootstrapOptions).toEqual(
      expect.objectContaining({
        overlay: expect.any(HTMLDivElement),
        services: expect.objectContaining({
          clock: runtimeMocks.clock,
          synth: runtimeMocks.synth,
          metronome: runtimeMocks.metronome,
          renderer: runtimeMocks.renderer,
        }),
      }),
    )

    const coordinatorOptions = runtimeMocks.createRuntimeCoordinators.mock.calls[0]?.[0]
    expect(coordinatorOptions).toEqual(
      expect.objectContaining({
        playback: expect.any(Object),
        midiFlow: expect.any(Object),
        exportFlow: expect.any(Object),
        runtimeOverlay: expect.any(Object),
      }),
    )

    app.dispose()

    expect(runtimeMocks.effectsUnsub).toHaveBeenCalledOnce()
    expect(runtimeMocks.inputUnsub).toHaveBeenCalledOnce()
    expect(runtimeMocks.domUnsub).toHaveBeenCalledOnce()
    expect(runtimeMocks.playback.releaseAllLiveNotes).toHaveBeenCalledOnce()
    expect(runtimeMocks.ui.dispose).toHaveBeenCalledOnce()
    expect(
      (runtimeMocks.renderer as { destroy: ReturnType<typeof vi.fn> }).destroy,
    ).toHaveBeenCalledOnce()
    expect(
      (runtimeMocks.synth as { dispose: ReturnType<typeof vi.fn> }).dispose,
    ).toHaveBeenCalledOnce()
    expect(
      (runtimeMocks.midiInput as { dispose: ReturnType<typeof vi.fn> }).dispose,
    ).toHaveBeenCalledOnce()
  })
})
