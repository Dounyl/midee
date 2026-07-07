import { AppApplicationController } from '@/app/runtime/AppApplicationController'
import type { AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import { createAppRuntimePortBundle } from '@/app/runtime/appRuntimePorts'
import { createAppRuntimeUiShell, type AppRuntimeUiShell } from '@/app/runtime/appRuntimeUiShell'
import {
  createBootstrapRuntimeUiConsole,
  createBootstrapRuntimeUiControls,
  createBootstrapRuntimeUiMenus,
  createBootstrapRuntimeUiPlayback,
} from '@/app/runtime/bootstrapUiActions'
import {
  requestConsoleKeyboardModeChange,
} from '@/app/runtime/bootstrapConsole'
import { createRuntimeCoordinators } from '@/app/runtime/runtimeCoordinators'
import { bindRuntimeDomEvents } from '@/app/runtime/runtimeDomEvents'
import { createRuntimeEffectsOptions } from '@/app/runtime/runtimeEffectOptions'
import { createRuntimeInputOptions } from '@/app/runtime/runtimeInputOptions'
import { createLearnRuntimeLifecycle } from '@/app/runtime/learnRuntimeLifecycle'
import { connectRuntimeMidi, openRuntimeFilePicker } from '@/app/runtime/runtimeUserFlows'
import {
  enterRuntimeLiveRoute,
  resolveRuntimeOpenTarget,
  resolveRuntimeTelemetryMode,
} from '@/app/runtime/runtimeRouteSemantics'
import { createDisplayPrefsState, createPlaybackSessionState } from '@/app/runtime/runtimePorts'
import { bootstrapRuntimeUi } from '@/app/runtime/bootstrapUi'
import { createExerciseRuntime, createPlayAlongRuntime } from '@/app/runtime/learnRuntimeFactories'
import { createAppPreferences } from '@/app/runtime/preferences'
import { syncLoadedMidiForCurrentRoute } from '@/app/runtime/routeEntry'
import type { AppShellHandles } from '@/app/runtime/types'
import { wireRuntimeEffects } from '@/app/runtime/wireRuntimeEffects'
import { wireRuntimeInput } from '@/app/runtime/wireRuntimeInput'
import { scheduleRuntimeWarmup } from '@/app/runtime/warmup'
import loadingStyles from '@/app.module.css'
import { showError, showSuccess } from '@/components/common/Toast'
import { installViewportClassSync } from '@/components/common/utils'
import { ActiveLearnRuntimeRegistry } from '@/features/learn/runtime/ActiveLearnRuntimeRegistry'
import { ExercisePageRuntime } from '@/features/learn/runtime/ExercisePageRuntime'
import { PlayAlongPageRuntime } from '@/features/learn/runtime/PlayAlongPageRuntime'
import type {
  CreateExercisePageRuntimeOptions,
  LearnRuntimeHandle,
} from '@/features/learn/runtime/types'
import { t } from '@/i18n'
import { assertDefined, assertOnce, invariant } from '@/lib/assert'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import { MasterClock } from '@/lib/core/MasterClock'
import { lazyHandle } from '@/lib/lazyHandle'
import { Metronome } from '@/services/audio/Metronome'
import { SynthEngine } from '@/services/audio/SynthEngine'
// VideoExporter pulls Mediabunny; OfflineAudioRenderer pulls Tone + instruments.
// Both are dynamic-imported from startExport(). Import order matters: load the
// offline-audio module first when audio is needed 閿?do not block Tone on the
// heavy VideoExporter chunk (see Promise.all removal below).
import type { VideoExporter } from '@/services/export/VideoExporter'
import { type BusNoteEvent, InputBus } from '@/services/input/InputBus'
import { CaptureFanout } from '@/services/midi/CaptureFanout'
import { ComputerKeyboardInput } from '@/services/midi/ComputerKeyboardInput'
import { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import { LiveLooper, type LiveLooperState } from '@/services/midi/LiveLooper'
import { LiveNoteStore } from '@/services/midi/LiveNoteStore'
import type { CapturedEvent } from '@/services/midi/MidiEncoding'
import { MidiInputManager } from '@/services/midi/MidiInputManager'
import { SessionRecorder } from '@/services/midi/SessionRecorder'
import {
  createLivePerformanceBus,
  type LivePerformanceBus,
} from '@/services/performance/LivePerformanceBus'
import { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import { THEMES } from '@/services/renderer/theme'
import type {
  DisplayPrefsState,
  LearnRuntimeRegistryPort,
  PlaybackSessionState,
} from '@/services/runtime/contracts'
import { ExportAndOverlayCoordinator } from '@/services/runtime/ExportAndOverlayCoordinator'
import { MidiFlowCoordinator } from '@/services/runtime/MidiFlowCoordinator'
import { PlaybackCoordinator } from '@/services/runtime/PlaybackCoordinator'
import { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import { track, trackEvent, trackEventSettled } from '@/services/telemetry'
import type { AppActions } from '@/stores/app/AppCtx'
import type { AppStore } from '@/stores/app/state'
import { watch } from '@/stores/app/watch'
import { getCurrentRouteTarget, navigateToTarget } from '@/stores/routing/routerBridge'
import {
  isLearnRouteTarget,
  isPlayRouteTarget,
  type RouteTarget,
  routeCapturesLive,
} from '@/stores/routing/routeTarget'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'

// Total note count across all tracks 閿?the content-size signal attached to
// midi_loaded so we can tie which pieces drive retention. Structurally typed
// to avoid coupling this helper to the MidiFile import.
export class App {
  private readonly preferences = createAppPreferences()
  private readonly hydratedPreferences = this.preferences.hydrate()
  private clock = new MasterClock()
  private renderer = new PianoRollRenderer()
  private synth = new SynthEngine()
  private inputBus = new InputBus()
  midiInput!: MidiInputManager
  keyboardInput!: ComputerKeyboardInput
  private liveNotes = new LiveNoteStore()
  private loopNotes = new LiveNoteStore()
  private liveLooper!: LiveLooper
  private metronome = new Metronome()
  private sessionRec!: SessionRecorder
  private capture!: CaptureFanout
  private ui!: RuntimeUiBridge
  private midiFlow!: MidiFlowCoordinator
  private playback!: PlaybackCoordinator
  private exportOverlay!: ExportAndOverlayCoordinator
  private readonly runtimeState: DisplayPrefsState
  private readonly playbackSession: PlaybackSessionState
  private exporterRef!: { current: VideoExporter | null }
  private pendingSessionRef!: { current: { events: CapturedEvent[]; duration: number } | null }
  private keyboardModeCoordinator!: KeyboardModeCoordinator
  private readonly learnRuntimeRegistry = new ActiveLearnRuntimeRegistry()
  private learnRuntimeLifecycle!: ReturnType<typeof createLearnRuntimeLifecycle>
  private appController!: AppApplicationController
  private uiShell!: AppRuntimeUiShell
  // Lazy modals: race-safe lazy initialisation via lazyHandle 閿?each is
  // constructed at most once, even under concurrent get() calls.
  private postSessionHandle = lazyHandle(() =>
    import('@/components/export/PostSessionModal').then(({ PostSessionModal }) => {
      const m = new PostSessionModal(this.overlay)
      m.onAction = (action) => void this.exportOverlay.handleSessionAction(action)
      return m
    }),
  )
  private pendingSession: { events: CapturedEvent[]; duration: number } | null = null
  private midiPickerHandle = lazyHandle(() =>
    import('@/components/export/MidiPickerModal').then(({ MidiPickerModal }) => {
      const m = new MidiPickerModal(this.overlay)
      return m
    }),
  )
  private exportHandle = lazyHandle(() =>
    import('@/components/export/ExportModal').then(({ ExportModal }) => {
      const m = new ExportModal(this.overlay)
      m.onStart = (settings) => void this.exportOverlay.startExport(settings)
      m.onCancel = () => this.exportOverlay.cancelExport()
      return m
    }),
  )
  // Captured in init() so the lazy ensureXModal() helpers can construct
  // without re-querying the DOM.
  private overlay!: HTMLElement
  // Shared handles passed into subsystems (Controls today, mode controllers and
  // exercises in follow-up tasks). Assembled once in init() from this.clock,
  // this.synth, etc. so the constructor list stays authoritative.
  // Public so `createApp()` can thread `services`/`store` into AppCtx.
  services!: AppServices
  readonly store: AppStore

  constructor(store: AppStore) {
    this.store = store
    const thisApp = this
    this.runtimeState = createDisplayPrefsState({
      getBaseMidi: () => this.baseMidi,
      setBaseMidi: (value) => {
        this.baseMidi = value
      },
      getTransposeSemitones: () => this.transposeSemitones,
      setTransposeSemitones: (value) => {
        this.transposeSemitones = value
      },
      getPitchLabelsVisible: () => this.pitchLabelsVisible,
      setPitchLabelsVisible: (value) => {
        this.pitchLabelsVisible = value
      },
      getChordOverlayOn: () => this.chordOverlayOn,
      setChordOverlayOn: (value) => {
        this.chordOverlayOn = value
      },
      getThemeIndex: () => this.themeIndex,
      setThemeIndex: (value) => {
        this.themeIndex = value
      },
      getInstrumentIndex: () => this.instrumentIndex,
      setInstrumentIndex: (value) => {
        this.instrumentIndex = value
      },
      getParticleIndex: () => this.particleIndex,
      setParticleIndex: (value) => {
        this.particleIndex = value
      },
      saveThemeIndex: (value) => this.preferences.stores.themeIndex.save(value),
      saveInstrumentIndex: (value) => this.preferences.stores.instrumentIndex.save(value),
      saveParticleIndex: (value) => this.preferences.stores.particleIndex.save(value),
      saveChordOverlay: (value) => this.preferences.stores.chordOverlay.save(value),
      savePitchLabels: (value) => this.preferences.stores.pitchLabels.save(value),
    })
    this.playbackSession = createPlaybackSessionState({ store: this.store })
    this.exporterRef = {
      get current() {
        return thisApp.currentExporter
      },
      set current(value) {
        thisApp.currentExporter = value
      },
    }
    this.pendingSessionRef = {
      get current() {
        return thisApp.pendingSession
      },
      set current(value) {
        thisApp.pendingSession = value
      },
    }
  }
  // Learn owns enough lifecycle state (hub, runner, overlay layer) that a
  // long-lived instance is cheapest. But constructing it pulls the entire
  // Learn module graph (LearnHub, ExerciseRunner, IntervalsEngine, 閿? into
  // the bundle, so we defer construction to first use. The mode context is
  // captured at boot so the lazy constructor doesn't need to re-derive it.
  private currentExporter: VideoExporter | null = null
  private baseMidi: import('@/types/midi/types').MidiFile | null = null
  private transposeSemitones = 0
  private chordOverlayOn = this.hydratedPreferences.chordOverlay
  private pitchLabelsVisible = this.hydratedPreferences.pitchLabels
  private themeIndex = this.hydratedPreferences.themeIndex
  private instrumentIndex = this.hydratedPreferences.instrumentIndex
  private particleIndex = this.hydratedPreferences.particleIndex
  private audioPrimed = false
  // Analytics one-shot flags. Reset when a new file is loaded so a user
  // who opens MIDI A then MIDI B gets `first_play` events for both.
  private firstPlayLogged = false
  private firstPedalLogged = false
  private playbackMilestones = new Set<number>()

  private currentRouteTarget(): RouteTarget | null {
    return getCurrentRouteTarget()
  }

  private createLearnRuntimeRegistryPort(): LearnRuntimeRegistryPort {
    return this.learnRuntimeRegistry
  }

  private createRuntimePorts() {
    return createAppRuntimePortBundle({
      services: {
        clock: this.clock,
        synth: this.synth,
        metronome: this.metronome,
        renderer: this.renderer,
        input: this.inputBus,
        keyboardMode: this.keyboardModeCoordinator,
      },
      primeInteractiveAudio: () => this.primeInteractiveAudio(),
      getUi: () => this.ui,
      showLoading: () => this.uiShell.showLoading(),
      hideLoading: () => this.uiShell.hideLoading(),
      showError: (message) => this.uiShell.showError(message),
      showSuccess: (message) => this.uiShell.showSuccess(message),
      closeTransientOverlays: () => this.uiShell.closeTransientOverlays(),
      openExportModal: async () => {
        const modal = await this.exportHandle.get()
        modal.open()
      },
      peekExportModal: () => this.exportHandle.peek(),
      openPostSession: async (duration, noteCount) => {
        const modal = await this.postSessionHandle.get()
        modal.open(duration, noteCount)
      },
      closePostSession: () => {
        this.postSessionHandle.peek()?.close()
      },
      openMidiPicker: async (options) => {
        const modal = await this.midiPickerHandle.get()
        modal.open(options)
      },
      closeMidiPicker: () => {
        this.midiPickerHandle.peek()?.close()
      },
      getCurrentTarget: () => this.currentRouteTarget(),
      navigate: (target, options) => {
        navigateToTarget(target, options)
      },
      enterLive: (primeAudio = true) =>
        enterRuntimeLiveRoute({
          primeAudio,
          navigate: (target) => navigateToTarget(target),
        }),
    })
  }

  private createApplicationController(
    ports: ReturnType<App['createRuntimePorts']>,
  ): AppApplicationController {
    return new AppApplicationController({
      services: ports.services,
      ui: ports.ui,
      navigation: ports.navigation,
      learnRuntimeRegistry: this.createLearnRuntimeRegistryPort(),
      displayPrefs: this.runtimeState,
      playbackSession: this.playbackSession,
      keyboardInput: {
        enable: () => this.keyboardInput.enable(),
      },
      fileFlows: {
        openFilePicker: (target) => this.openFilePicker(target),
        openSample: (sampleId, target) => this.midiFlow.openSample(sampleId, target),
        openLocalMidi: (id, target) => this.midiFlow.openLocal(id, target),
        enterLearn: (request) => this.midiFlow.enterLearn(request),
      },
      resetInteractionState: () => this.resetInteractionState(),
      syncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
    })
  }
  // Loop station one-shots, scoped to the page session. We want to know
  // whether users ever reach each step in the loop funnel, not count every
  // state flip 閿?the state machine toggles rapidly during overdub.
  // Sustain pedal state managed by LivePerformanceBus 閿?keyboard OR MIDI
  // sources merged with an OR. The bus owns sustained-pitches bookkeeping,
  // repress-release logic, and subscriber fan-out.
  private performanceBus!: LivePerformanceBus
  private onVisibilityChange = (): void => {
    if (document.hidden) this.releaseAllLiveNotes()
  }
  private onWindowBlur = (): void => this.releaseAllLiveNotes()
  private onFirstPointerDown = (): void => this.primeInteractiveAudio()
  private onFirstKeyDown = (): void => this.primeInteractiveAudio()
  // Unsubscribe closures from every Signal.subscribe() in init(). Invoked from
  // dispose() so each Signal's listener set is cleared 閿?otherwise the
  // captured `this` leaks for the lifetime of the surrounding signals.
  private unsubs: Array<() => void> = []
  private readonly subscriptionLabels = new Set<string>()
  private initialized = false
  private disposed = false

  private get keyboardMode(): KeyboardMode {
    return (
      this.keyboardModeCoordinator?.getMode() ??
      (this.preferences.stores.keyboardMode61.load() ? '61' : '88')
    )
  }

  async init(
    handles: AppShellHandles,
    createActions: (driver: AppIntentDriver) => AppActions,
  ): Promise<AppActions> {
    const app = this
    assertOnce(this.initialized, 'App runtime cannot boot more than once')
    invariant(!this.disposed, 'App runtime cannot boot after dispose()')
    const canvas = assertDefined(handles.canvas, 'App runtime init requires a canvas handle')
    const overlay = assertDefined(handles.overlay, 'App runtime init requires an overlay handle')
    this.overlay = overlay
    this.initialized = true

    // Flip `body.is-touch` / `body.is-narrow` so CSS can adapt (bottom-sheet
    // popovers, touch-friendly hit targets, etc.).
    installViewportClassSync()

    await this.renderer.init(canvas)
    this.renderer.attachClock(this.clock)
    this.renderer.setLiveNoteStore(this.liveNotes)
    this.renderer.setLoopNoteStore(this.loopNotes)
    this.renderer.setPitchLabelsVisible(this.pitchLabelsVisible)

    this.midiInput = new MidiInputManager(this.clock)
    this.keyboardInput = new ComputerKeyboardInput(this.clock)
    this.keyboardModeCoordinator = new KeyboardModeCoordinator({
      initialMode: this.preferences.stores.keyboardMode61.load() ? '61' : '88',
      persistMode: (mode) => this.preferences.stores.keyboardMode61.save(mode === '61'),
      applyMode: (mode) => this.renderer.setKeyboardMode(mode),
      syncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
    })

    this.liveLooper = new LiveLooper(
      this.clock,
      {
        onPlaybackNoteOn: (pitch, velocity, ctxTime) => {
          // Audio is sample-accurately scheduled via the AudioContext clock.
          this.synth.scheduleNoteOn(pitch, velocity, ctxTime)
          // Visuals and session capture fire at ~wall time by deferring the
          // work until ctxTime arrives. setTimeout jitter (~1閿? ms) is
          // imperceptible vs. audio, whereas drawing now (up to 150 ms early)
          // would visibly desync the falling notes.
          this.deferToCtxTime(ctxTime, () => {
            this.loopNotes.press(pitch, velocity, this.clock.currentTime)
            this.sessionRec.captureNoteOn(pitch, velocity, this.clock.currentTime)
          })
        },
        onPlaybackNoteOff: (pitch, ctxTime) => {
          this.synth.scheduleNoteOff(pitch, ctxTime)
          this.deferToCtxTime(ctxTime, () => {
            this.loopNotes.release(pitch, this.clock.currentTime)
            this.sessionRec.captureNoteOff(pitch, this.clock.currentTime)
          })
        },
      },
      // Bar-snap when the metronome is running 閿?rounds loop length to the
      // nearest whole bar at current BPM (4/4). Off 閿?freeform length.
      (raw) => {
        if (!this.metronome.running.value) return raw
        const secPerBar = (60 / this.metronome.bpm.value) * 4
        const bars = Math.max(1, Math.round(raw / secPerBar))
        return bars * secPerBar
      },
    )

    this.sessionRec = new SessionRecorder(this.clock)

    // Fan-out that routes capture events to both looper and sessionRec in
    // a single call. Eliminates the duplicated call pairs below.
    this.capture = new CaptureFanout(this.liveLooper, this.sessionRec)

    // LivePerformanceBus owns pedal merge (keyboard OR MIDI), sustained-pitch
    // bookkeeping, and subscriber fan-out for live performance events.
    this.performanceBus = createLivePerformanceBus()

    this.services = {
      store: this.store,
      clock: this.clock,
      synth: this.synth,
      metronome: this.metronome,
      renderer: this.renderer,
      input: this.inputBus,
    }
    this.uiShell = createAppRuntimeUiShell({
      overlay,
      loadingStyles,
      exportHandle: this.exportHandle,
      postSessionHandle: this.postSessionHandle,
      midiPickerHandle: this.midiPickerHandle,
      showError,
      showSuccess,
    })
    const ports = this.createRuntimePorts()
    this.appController = this.createApplicationController(ports)
    const actions = createActions(this.appController)

    const runtimeUi = bootstrapRuntimeUi({
      overlay,
      services: this.services,
      actions,
      controls: createBootstrapRuntimeUiControls({
        seek: (time) => {
          this.synth.seek(time)
          this.liveNotes.reset()
        },
        zoom: (pixelsPerSecond) => this.renderer.setZoom(pixelsPerSecond),
        cycleTheme: () => this.exportOverlay.cycleTheme(),
        connectMidi: () => this.connectMidi(),
        openTracks: () => this.ui.toggleTrackPanel(),
        openExport: () => this.exportOverlay.openExportModal(),
        hasLoadedMidi: () => this.store.state.loadedMidi !== null,
        setTranspose: (semitones) => this.exportOverlay.handleTransposeChange(semitones),
        cycleInstrument: () => this.exportOverlay.cycleInstrument(),
        cycleParticleStyle: () => this.exportOverlay.cycleParticleStyle(),
        toggleLoop: () => this.liveLooper.toggle(),
        getLoopLayerCount: () => this.liveLooper.layerCount.value,
        clearLoop: () => this.liveLooper.clear(),
        saveLoopAsMidi: () => this.exportOverlay.saveLoopAsMidi(),
        undoLoop: () => this.liveLooper.undo(),
        toggleMetronome: () => this.metronome.toggle(),
        isMetronomeRunning: () => this.metronome.running.value,
        setMetronomeBpm: (bpm) => this.metronome.setBpm(bpm),
        getMetronomeBpm: () => this.metronome.bpm.value,
        persistMetronomeBpm: (bpm) => this.preferences.stores.metronomeBpm.save(bpm),
        toggleSessionRecord: () => this.exportOverlay.toggleSessionRecord(),
        toggleChordOverlay: () => this.exportOverlay.toggleChordOverlay(),
        shiftOctave: (delta) => {
          if (delta < 0) this.keyboardInput.shiftOctaveDown()
          else this.keyboardInput.shiftOctaveUp()
        },
      }),
      playback: createBootstrapRuntimeUiPlayback({
        renderer: this.renderer,
        openDroppedMidi: (file, source) => {
          const target = resolveRuntimeOpenTarget(this.currentRouteTarget())
          return this.midiFlow.openFile(file, source, target)
        },
        setTrackEnabled: (id, enabled) => this.synth.setTrackEnabled(id, enabled),
        openFilePicker: () => this.openFilePicker(),
        selectInstrument: (id) => this.exportOverlay.setInstrumentById(id),
      }),
      menus: createBootstrapRuntimeUiMenus({
        chordOverlayOn: this.chordOverlayOn,
        setThemeByIndex: (idx) => this.exportOverlay.setThemeByIndex(idx),
        setParticleByIndex: (idx) => this.exportOverlay.setParticleByIndex(idx),
        toggleChordOverlay: () => this.exportOverlay.toggleChordOverlay(),
      }),
      overlayUi: createBootstrapRuntimeUiConsole({
        handleTransposeChange: (value) => this.exportOverlay.handleTransposeChange(value),
        getLearnBaseKey: () =>
          this.learnRuntimeRegistry.getConsoleStateProvider()?.getConsoleState().baseKey ?? null,
        getPlayBaseKey: () => this.baseMidi?.keySignature ?? null,
        includeLearnBaseKey: () => isLearnRouteTarget(this.currentRouteTarget()),
        requestKeyboardModeChange: (mode, options) => {
          requestConsoleKeyboardModeChange({
            mode,
            coordinator: this.keyboardModeCoordinator,
            activeMidi: options.activeMidi,
            onTranspose: options.onTranspose,
          })
        },
        getActiveMidi: () =>
          isLearnRouteTarget(this.currentRouteTarget())
            ? (this.learnRuntimeRegistry.getMidiBackedRuntime()?.getLoadedMidi() ?? null)
            : this.store.state.loadedMidi,
        setPitchLabelsVisible: (visible) => this.exportOverlay.setPitchLabelsVisible(visible),
      }),
    })
    this.ui = runtimeUi.ui

    this.metronome.setBpm(this.preferences.stores.metronomeBpm.load())
    this.renderer.setKeyboardMode(this.keyboardMode)
    this.exportOverlay?.syncConsolePanel()

    // ExportModal / PostSessionModal / MidiPickerModal are constructed lazily
    // (see ensureXModal helpers further down) 閿?none of them are visible at
    // boot, and keeping them out of the initial chunk shaves ~835 LOC of JSX
    // off the first-paint bundle.

    this.chordOverlayOn = this.preferences.stores.chordOverlay.load()
    // File mode actively plays a MIDI 閿?the chord chip would just narrate
    // what the user is already hearing without contributing to "play along"
    // affordances. Keep it scoped to live/home where it confirms what the
    // player is sounding.
    // Customization popover bundles theme / particles / chord toggle 閿?
    // collapses three topbar pills into a single trigger.
    const servicesCtx = ports.services
    const uiPort = ports.ui
    const navigationPort = ports.navigation
    const learnRuntimeRegistryPort = this.createLearnRuntimeRegistryPort()
    this.learnRuntimeLifecycle = createLearnRuntimeLifecycle({
      registry: learnRuntimeRegistryPort,
      syncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
    })
    const displayPrefs = this.runtimeState
    const playbackSession = this.playbackSession

    const coordinators = createRuntimeCoordinators({
      playback: {
        store: this.store,
        clock: this.clock,
        synth: this.synth,
        renderer: this.renderer,
        liveNotes: this.liveNotes,
        loopNotes: this.loopNotes,
        liveLooper: this.liveLooper,
        sessionRec: this.sessionRec,
        metronome: this.metronome,
        capture: this.capture,
        performanceBus: this.performanceBus,
        getCurrentTarget: () => this.currentRouteTarget(),
        enterLiveMode: (primeAudio = true) =>
          enterRuntimeLiveRoute({
            primeAudio,
            navigate: (target) => navigateToTarget(target),
          }),
        closeTransientOverlays: () => this.uiShell.closeTransientOverlays(),
      },
      midiFlow: {
        services: servicesCtx,
        ui: uiPort,
        navigation: navigationPort,
        displayPrefs,
        playbackSession,
        keyboardInput: this.keyboardInput,
        onSyncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
        onResetInteractionState: () => this.resetInteractionState(),
        handoffPreparedPlayAlong: (midi) => this.appController.openPreparedPlayAlong(midi),
        resetPlaybackTelemetry: () => this.resetPlaybackTelemetry(),
      },
      exportOverlay: {
        services: servicesCtx,
        ui: uiPort,
        navigation: navigationPort,
        learnRuntimeRegistry: learnRuntimeRegistryPort,
        displayPrefs,
        playbackSession,
        liveNotes: this.liveNotes,
        loopNotes: this.loopNotes,
        liveLooper: this.liveLooper,
        sessionRec: this.sessionRec,
        exporterRef: this.exporterRef,
        pendingSessionRef: this.pendingSessionRef,
        loadSessionMidi: (midi) => this.midiFlow.loadSessionMidi(midi),
      },
      initialTheme: THEMES[this.themeIndex]!,
    })
    this.playback = coordinators.playback
    this.midiFlow = coordinators.midiFlow
    this.exportOverlay = coordinators.exportOverlay

    // Idle-time warmups. None of these affect first paint 閿?they trade
    // background bandwidth for "feels instant" on first-click flows. All
    // share the default deadline; on a typical browser they fire in the
    // same idle frame ~150-300 ms after boot, kicking off network fetches
    // in parallel.
    //   閿?synth piano samples 閿?first-note latency
    //   閿?@tonejs/midi 閿?sample-card click + record-export
    //   閿?modal chunks 閿?first export / file-picker / post-session click
    //   閿?LearnController (only when Learn is enabled) 閿?first Learn entry
    scheduleRuntimeWarmup({
      preloadDefaultInstrument: () => this.synth.preloadDefault(),
    })

    this.ui.syncMidiStatus(this.midiInput.status.value, this.midiInput.deviceName.value)
    const firstPlayLoggedRef = {
      get current() {
        return app.firstPlayLogged
      },
      set current(value: boolean) {
        app.firstPlayLogged = value
      },
    }
    for (
      const group of wireRuntimeEffects(
        createRuntimeEffectsOptions({
          ui: this.ui,
          route: {
            currentTarget: () => this.currentRouteTarget(),
            currentTelemetryMode: () =>
              resolveRuntimeTelemetryMode(this.currentRouteTarget()),
            syncConsolePanel: () => this.exportOverlay.syncConsolePanel(),
            applyChordOverlayVisibility: () => this.exportOverlay.applyChordOverlayVisibility(),
            handleLoadedMidiChange: () =>
              syncLoadedMidiForCurrentRoute({
                syncConsolePanel: () => this.exportOverlay.syncConsolePanel(),
                currentRouteTarget: () => this.currentRouteTarget(),
                enterPlayRoute: (options) => this.appController.enterPlayRoute(options),
              }),
          },
          playback: {
            store: this.store,
            clock: this.clock,
            synth: this.synth,
            liveLooper: this.liveLooper,
            metronome: this.metronome,
            sessionRec: this.sessionRec,
            onTrackLoopTransition: (next) => this.trackLoopTransition(next),
            onResetLiveNotes: () => {
              this.liveNotes.releaseAll(this.clock.currentTime)
              this.synth.liveReleaseAll()
            },
            onMaybeUpdateChordOverlay: (time) => this.exportOverlay.maybeUpdateChordOverlay(time),
            onFirstPlaybackMilestone: () => {},
            onSpeedChange: (speed) => {
              this.clock.speed = speed
              this.synth.setSpeed(speed)
            },
            playbackMilestones: this.playbackMilestones,
            firstPlayLoggedRef,
            applyInstrumentLoading: (id) => this.ui.setInstrumentMenuLoading(id),
          },
          midi: {
            input: this.midiInput,
          },
        }),
      )
    ) {
      this.registerUnsubs(group.label, ...group.unsubs)
    }

    for (
      const group of wireRuntimeInput(
        createRuntimeInputOptions({
          midi: {
            input: this.midiInput,
          },
          keyboard: {
            input: this.keyboardInput,
            syncOctave: (octave) => this.ui.syncOctave(octave),
          },
          touch: {
            canvas,
            getCurrentTime: () => this.clock.currentTime,
            getStatus: () => this.store.state.status,
            resolvePitch: (clientX: number, clientY: number) =>
              this.renderer.pitchAtClientPoint(clientX, clientY),
            primeInteractiveAudio: () => this.primeInteractiveAudio(),
          },
          bridge: {
            inputBus: this.inputBus,
            performanceBus: this.performanceBus,
            synth: this.synth,
            liveNotes: this.liveNotes,
            capture: this.capture,
            getCurrentTime: () => this.clock.currentTime,
            shouldCapturePerformance: () => routeCapturesLive(this.currentRouteTarget()),
            onPedalUsed: (source) => {
              if (!this.firstPedalLogged) {
                this.firstPedalLogged = true
                track('pedal_used', { source })
              }
            },
            onLiveNoteOn: (evt) => this.handleLiveNoteOn(evt),
            onLiveNoteOff: (evt) => this.handleLiveNoteOff(evt),
          },
        }),
      )
    ) {
      this.registerUnsubs(group.label, ...group.unsubs)
    }

    this.registerUnsubs(
      'dom-events',
      bindRuntimeDomEvents({
        documentTarget: document,
        windowTarget: window,
        onVisibilityChange: this.onVisibilityChange,
        onWindowBlur: this.onWindowBlur,
        onFirstPointerDown: this.onFirstPointerDown,
        onFirstKeyDown: this.onFirstKeyDown,
      }),
    )

    void this.autoConnectMidi()
    return actions
  }

  private registerUnsubs(label: string, ...unsubs: Array<() => void>): void {
    assertOnce(
      this.subscriptionLabels.has(label),
      `Duplicate runtime subscription registration: ${label}`,
    )
    this.subscriptionLabels.add(label)
    this.unsubs.push(() => {
      this.subscriptionLabels.delete(label)
      for (const unsub of unsubs) unsub()
    })
  }

  private assertActionReady(action: string): void {
    invariant(this.initialized, `${action}() called before app runtime finished booting`)
    invariant(!this.disposed, `${action}() called after app runtime was disposed`)
  }

  private releaseAllLiveNotes(): void {
    this.playback.releaseAllLiveNotes()
  }

  // Called whenever a new MIDI is loaded so the telemetry flags scoped to
  // "this piece" fire for the next one too. `first_play` re-arms, playback
  // milestones reset so 30/60/120s fire again for the new file.
  private resetPlaybackTelemetry(): void {
    this.firstPlayLogged = false
    this.playbackMilestones.clear()
  }

  // Loop funnel: fire once-per-session on `armed` and first `playing`, and
  // fire `loop_layer_added` every time an overdub passes commits as a new
  // layer (overdubbing 閿?playing). Skipping transitions that just return to
  // `idle` keeps the event stream tied to user intent, not UI housekeeping.
  private trackLoopTransition(next: LiveLooperState): void {
    this.playback.trackLoopTransition(next)
  }

  private handleLiveNoteOn(evt: BusNoteEvent): void {
    this.playback.handleLiveNoteOn(evt)
  }

  private handleLiveNoteOff(evt: BusNoteEvent): void {
    this.playback.handleLiveNoteOff(evt)
  }

  private async connectMidi(): Promise<void> {
    await connectRuntimeMidi({
      midiInput: this.midiInput,
      primeInteractiveAudio: () => this.primeInteractiveAudio(),
      showError: (message) => this.uiShell.showError(message),
    })
  }

  private async autoConnectMidi(): Promise<void> {
    await this.midiInput.requestAccess({ silent: true })
  }

  // Entry point for every "open MIDI" action. `target` is resolved at click
  // time so Play-vs-Learn routing stays stable during async picker flows.
  private openFilePicker(target?: 'play' | 'learn'): void {
    openRuntimeFilePicker({
      target,
      getCurrentRouteTarget: () => this.currentRouteTarget(),
      getMidiPickerModal: () => this.midiPickerHandle.get(),
      midiFlow: this.midiFlow,
      appController: this.appController,
    })
  }

  createPlayAlongPageRuntime(): PlayAlongPageRuntime {
    this.assertActionReady('createPlayAlongPageRuntime')
    return createPlayAlongRuntime({
      services: this.services,
      overlayRoot: this.overlay,
      keyboardMode: this.keyboardModeCoordinator,
      setLearnFileName: (name) => this.ui.setLearnFileName(name),
      updateConsolePanel: () => this.exportOverlay.syncConsolePanel(),
      lifecycle: {
        onActivate: (runtime) => this.learnRuntimeLifecycle.activate(runtime),
        onDeactivate: (runtime) => this.learnRuntimeLifecycle.deactivate(runtime),
      },
      consumePendingMidi: () => this.learnRuntimeRegistry.consumePreparedPlayAlongMidi(),
    })
  }

  createExercisePageRuntime(options: CreateExercisePageRuntimeOptions): ExercisePageRuntime {
    this.assertActionReady('createExercisePageRuntime')
    return createExerciseRuntime({
      services: this.services,
      overlayRoot: this.overlay,
      page: options,
      lifecycle: {
        onActivate: (runtime) => this.learnRuntimeLifecycle.activate(runtime),
        onDeactivate: (runtime) => this.learnRuntimeLifecycle.deactivate(runtime),
      },
    })
  }

  async prepareBenchPlayback(midi: MidiFile): Promise<void> {
    this.assertActionReady('prepareBenchPlayback')
    this.resetInteractionState()
    this.store.beginPlayLoad()
    this.renderer.clearMidi()
    await this.synth.load(midi)
    this.store.completePlayLoad(midi)
    this.renderer.loadMidi(midi)
    this.appController.enterPlayRoute({ skipAnalytics: true })
  }

  startBenchPlayback(): void {
    this.assertActionReady('startBenchPlayback')
    this.primeInteractiveAudio()
    this.clock.play()
    this.store.setState('status', 'playing')
  }

  // Schedules a UI side-effect to run at (roughly) the AudioContext time
  // `ctxTime`. Used so the visual press of a loop-played note lands with the
  // audio instead of up to 150 ms early when the scheduler runs ahead.
  private deferToCtxTime(ctxTime: number, fn: () => void): void {
    this.playback.deferToCtxTime(ctxTime, fn)
  }

  private resetInteractionState(): void {
    this.assertActionReady('resetInteractionState')
    this.playback.resetInteractionState()
  }

  private primeInteractiveAudio(): void {
    this.assertActionReady('primeInteractiveAudio')
    if (this.audioPrimed) return
    this.audioPrimed = true
    this.clock.prime()
    this.synth.primeLiveInput()
    window.removeEventListener('pointerdown', this.onFirstPointerDown)
    window.removeEventListener('keydown', this.onFirstKeyDown)
  }

  dispose(): void {
    assertOnce(this.disposed, 'App runtime dispose() cannot run more than once')
    invariant(this.initialized, 'App runtime dispose() called before boot completed')
    this.disposed = true
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
    this.releaseAllLiveNotes()
    this.midiInput.dispose()
    this.keyboardInput.dispose()
    this.liveLooper.dispose()
    this.sessionRec.dispose()
    this.metronome.dispose()
    this.ui.dispose()
    this.clock.dispose()
    this.renderer.destroy()
    this.synth.dispose()
  }
}
