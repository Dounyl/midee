import { AppApplicationController } from '@/app/runtime/AppApplicationController'
import type { AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import { createAppRuntimeUiShell } from '@/app/runtime/appRuntimeUiShell'
import {
  createBootstrapRuntimeUiConsole,
  createBootstrapRuntimeUiControls,
  createBootstrapRuntimeUiMenus,
  createBootstrapRuntimeUiPlayback,
} from '@/app/runtime/bootstrapUiActions'
import { requestConsoleKeyboardModeChange } from '@/app/runtime/bootstrapConsole'
import { RuntimeDependencies } from '@/app/runtime/composition/RuntimeDependencies'
import { RuntimeEventWiring } from '@/app/runtime/composition/RuntimeEventWiring'
import { RuntimeLearnFactory } from '@/app/runtime/composition/RuntimeLearnFactory'
import { RuntimeLifecycle } from '@/app/runtime/composition/RuntimeLifecycle'
import { RuntimePortsFactory } from '@/app/runtime/composition/RuntimePortsFactory'
import { RuntimeState } from '@/app/runtime/composition/RuntimeState'
import { createLearnRuntimeLifecycle } from '@/app/runtime/learnRuntimeLifecycle'
import { createAppPreferences } from '@/app/runtime/preferences'
import { createDisplayPrefsState, createPlaybackSessionState } from '@/app/runtime/runtimePorts'
import { createRuntimeCoordinators } from '@/app/runtime/runtimeCoordinators'
import { createRuntimeEffectsOptions } from '@/app/runtime/runtimeEffectOptions'
import { createRuntimeInputOptions } from '@/app/runtime/runtimeInputOptions'
import {
  enterRuntimeLiveRoute,
  resolveRuntimeOpenTarget,
  resolveRuntimeTelemetryMode,
} from '@/app/runtime/runtimeRouteSemantics'
import { syncLoadedMidiForCurrentRoute } from '@/app/runtime/routeEntry'
import { connectRuntimeMidi, openRuntimeFilePicker } from '@/app/runtime/runtimeUserFlows'
import type { AppShellHandles } from '@/app/runtime/types'
import { scheduleRuntimeWarmup } from '@/app/runtime/warmup'
import { bootstrapRuntimeUi } from '@/app/runtime/bootstrapUi'
import loadingStyles from '@/app.module.css'
import { showError, showSuccess } from '@/components/common/Toast'
import { installViewportClassSync } from '@/components/common/utils'
import type { CreateExercisePageRuntimeOptions } from '@/features/learn/runtime/types'
import { lazyHandle } from '@/lib/lazyHandle'
import { assertDefined } from '@/lib/assert'
import type { BusNoteEvent } from '@/services/input/InputBus'
import { THEMES } from '@/services/renderer/theme'
import { track } from '@/services/telemetry'
import type { AppActions } from '@/stores/app/AppCtx'
import type { AppStore } from '@/stores/app/state'
import { getCurrentRouteTarget, navigateToTarget } from '@/stores/routing/routerBridge'
import {
  isLearnRouteTarget,
  routeCapturesLive,
} from '@/stores/routing/routeTarget'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'

/**
 * App Runtime - Composition Root (Refactored)
 *
 * Reduced from 874 lines to ~400 lines through modular decomposition.
 * Responsibilities delegated to:
 * - RuntimeDependencies: service instantiation & DI
 * - RuntimeLifecycle: init/dispose + subscription management
 * - RuntimeState: preferences + flags
 * - RuntimePortsFactory: port bundle construction
 * - RuntimeEventWiring: effects/input wiring
 * - RuntimeLearnFactory: learn runtime factories
 */
export class App {
  // Core modules
  private readonly dependencies: RuntimeDependencies
  private readonly lifecycle = new RuntimeLifecycle()
  private readonly state: RuntimeState
  private readonly preferences = createAppPreferences()
  private readonly hydratedPreferences = this.preferences.hydrate()

  // Sub-modules (initialized in init())
  private portsFactory!: RuntimePortsFactory
  private eventWiring!: RuntimeEventWiring
  private learnFactory!: RuntimeLearnFactory
  private learnRuntimeLifecycle!: ReturnType<typeof createLearnRuntimeLifecycle>

  // Lazy modals
  private postSessionHandle = lazyHandle(() =>
    import('@/components/export/PostSessionModal').then(({ PostSessionModal }) => {
      const m = new PostSessionModal(this.overlay!)
      m.onAction = (action) => void this.dependencies.exportOverlay.handleSessionAction(action)
      return m
    }),
  )
  private midiPickerHandle = lazyHandle(() =>
    import('@/components/export/MidiPickerModal').then(({ MidiPickerModal }) => {
      return new MidiPickerModal(this.overlay!)
    }),
  )
  private exportHandle = lazyHandle(() =>
    import('@/components/export/ExportModal').then(({ ExportModal }) => {
      const m = new ExportModal(this.overlay!)
      m.onStart = (settings) => void this.dependencies.exportOverlay.startExport(settings)
      m.onCancel = () => this.dependencies.exportOverlay.cancelExport()
      return m
    }),
  )

  private overlay!: HTMLElement
  private onVisibilityChange = () => { if (document.hidden) this.releaseAllLiveNotes() }
  private onWindowBlur = () => this.releaseAllLiveNotes()
  private onFirstPointerDown = () => this.primeInteractiveAudio()
  private onFirstKeyDown = () => this.primeInteractiveAudio()

  // Public API
  readonly store: AppStore
  services!: AppServices

  get ctx() {
    return {
      store: this.store,
      services: this.services,
      runtimeFactories: {
        createPlayAlongPageRuntime: () => this.createPlayAlongPageRuntime(),
        createExercisePageRuntime: (opts: CreateExercisePageRuntimeOptions) =>
          this.createExercisePageRuntime(opts),
      },
    }
  }

  constructor(store: AppStore) {
    this.store = store
    this.dependencies = new RuntimeDependencies(store)
    this.state = new RuntimeState(
      this.hydratedPreferences,
      () => this.createDisplayPrefsPort() as any,
      () => createPlaybackSessionState({ store: this.store }) as any,
    )
  }

  private createDisplayPrefsPort() {
    const state = this.state
    const prefs = this.preferences
    return createDisplayPrefsState({
      getBaseMidi: () => state.baseMidi,
      setBaseMidi: (v) => { state.baseMidi = v },
      getTransposeSemitones: () => state.transposeSemitones,
      setTransposeSemitones: (v) => { state.transposeSemitones = v },
      getPitchLabelsVisible: () => state.pitchLabelsVisible,
      setPitchLabelsVisible: (v) => { state.pitchLabelsVisible = v },
      getChordOverlayOn: () => state.chordOverlayOn,
      setChordOverlayOn: (v) => { state.chordOverlayOn = v },
      getThemeIndex: () => state.themeIndex,
      setThemeIndex: (v) => { state.themeIndex = v },
      getInstrumentIndex: () => state.instrumentIndex,
      setInstrumentIndex: (v) => { state.instrumentIndex = v },
      getParticleIndex: () => state.particleIndex,
      setParticleIndex: (v) => { state.particleIndex = v },
      saveThemeIndex: (v) => prefs.stores.themeIndex.save(v),
      saveInstrumentIndex: (v) => prefs.stores.instrumentIndex.save(v),
      saveParticleIndex: (v) => prefs.stores.particleIndex.save(v),
      saveChordOverlay: (v) => prefs.stores.chordOverlay.save(v),
      savePitchLabels: (v) => prefs.stores.pitchLabels.save(v),
    })
  }

  async init(
    handles: AppShellHandles,
    createActions: (driver: AppIntentDriver) => AppActions,
  ): Promise<AppActions> {
    this.lifecycle.markInitialized()
    const canvas = assertDefined(handles.canvas, 'canvas required')
    const overlay = assertDefined(handles.overlay, 'overlay required')
    this.overlay = overlay
    const self = this
    installViewportClassSync()

    // Phase 1: Init renderer
    await this.dependencies.renderer.init(canvas)
    this.dependencies.renderer.attachClock(this.dependencies.clock)
    this.dependencies.renderer.setLiveNoteStore(this.dependencies.liveNotes)
    this.dependencies.renderer.setLoopNoteStore(this.dependencies.loopNotes)
    this.dependencies.renderer.setPitchLabelsVisible(this.state.pitchLabelsVisible)

    // Phase 2: Init dependent services
    this.dependencies.initDependentServices({
      keyboardMode: this.preferences.stores.keyboardMode61.load() ? '61' : '88',
      persistKeyboardMode: (m) => this.preferences.stores.keyboardMode61.save(m === '61'),
      applyKeyboardMode: (m) => this.dependencies.renderer.setKeyboardMode(m),
      getSyncConsolePanel: () => () => this.dependencies.exportOverlay?.syncConsolePanel(),
      getLooperCallbacks: () => ({
        onPlaybackNoteOn: (pitch, velocity, ctxTime) => {
          this.dependencies.synth.scheduleNoteOn(pitch, velocity, ctxTime)
          this.deferToCtxTime(ctxTime, () => {
            this.dependencies.loopNotes.press(pitch, velocity, this.dependencies.clock.currentTime)
            this.dependencies.sessionRec.captureNoteOn(pitch, velocity, this.dependencies.clock.currentTime)
          })
        },
        onPlaybackNoteOff: (pitch, ctxTime) => {
          this.dependencies.synth.scheduleNoteOff(pitch, ctxTime)
          this.deferToCtxTime(ctxTime, () => {
            this.dependencies.loopNotes.release(pitch, this.dependencies.clock.currentTime)
            this.dependencies.sessionRec.captureNoteOff(pitch, this.dependencies.clock.currentTime)
          })
        },
      }),
      getLooperSnapFn: () => (raw) => {
        if (!this.dependencies.metronome.running.value) return raw
        const secPerBar = (60 / this.dependencies.metronome.bpm.value) * 4
        return Math.max(1, Math.round(raw / secPerBar)) * secPerBar
      },
    })

    this.dependencies.setLazyHandles({
      postSessionHandle: this.postSessionHandle,
      midiPickerHandle: this.midiPickerHandle,
      exportHandle: this.exportHandle,
    })

    // Phase 3: UI shell
    const uiShell = createAppRuntimeUiShell({
      overlay,
      loadingStyles,
      exportHandle: this.exportHandle,
      postSessionHandle: this.postSessionHandle,
      midiPickerHandle: this.midiPickerHandle,
      showError,
      showSuccess,
    })

    // Phase 4: Ports
    this.portsFactory = new RuntimePortsFactory(this.dependencies, this.state, uiShell)
    const ports = this.portsFactory.createPorts()

    this.services = {
      store: this.store,
      clock: this.dependencies.clock,
      synth: this.dependencies.synth,
      metronome: this.dependencies.metronome,
      renderer: this.dependencies.renderer,
      input: this.dependencies.inputBus,
    }

    // Phase 5: Bootstrap UI
    const runtimeUi = bootstrapRuntimeUi({
      overlay,
      services: this.services,
      actions: null as any,
      controls: this.createControlsOptions(),
      playback: createBootstrapRuntimeUiPlayback({
        renderer: this.dependencies.renderer,
        openDroppedMidi: (file, source) => {
          const target = resolveRuntimeOpenTarget(getCurrentRouteTarget())
          return this.dependencies.midiFlow.openFile(file, source, target)
        },
        setTrackEnabled: (id, enabled) => this.dependencies.synth.setTrackEnabled(id, enabled),
        openFilePicker: () => this.openFilePicker(),
        selectInstrument: (id) => this.dependencies.exportOverlay.setInstrumentById(id),
      }),
      menus: createBootstrapRuntimeUiMenus({
        chordOverlayOn: this.state.chordOverlayOn,
        setThemeByIndex: (idx) => this.dependencies.exportOverlay.setThemeByIndex(idx),
        setParticleByIndex: (idx) => this.dependencies.exportOverlay.setParticleByIndex(idx),
        toggleChordOverlay: () => this.dependencies.exportOverlay.toggleChordOverlay(),
      }),
      overlayUi: this.createOverlayUiOptions(),
    })

    this.dependencies.ui = runtimeUi.ui
    this.dependencies.metronome.setBpm(this.preferences.stores.metronomeBpm.load())
    this.dependencies.renderer.setKeyboardMode(this.dependencies.keyboardModeCoordinator.getMode())

    // Phase 6: Coordinators
    const coordinators = createRuntimeCoordinators({
      playback: {
        store: this.store,
        clock: this.dependencies.clock,
        synth: this.dependencies.synth,
        renderer: this.dependencies.renderer,
        liveNotes: this.dependencies.liveNotes,
        loopNotes: this.dependencies.loopNotes,
        liveLooper: this.dependencies.liveLooper,
        sessionRec: this.dependencies.sessionRec,
        metronome: this.dependencies.metronome,
        capture: this.dependencies.capture,
        performanceBus: this.dependencies.performanceBus,
        getCurrentTarget: () => getCurrentRouteTarget(),
        enterLiveMode: (primeAudio = true) =>
          enterRuntimeLiveRoute({
            primeAudio,
            navigate: (target) => navigateToTarget(target),
          }),
        closeTransientOverlays: () => uiShell.closeTransientOverlays(),
      },
      midiFlow: {
        services: ports.services,
        ui: ports.ui,
        navigation: ports.navigation,
        displayPrefs: this.state.displayPrefs as any,
        playbackSession: this.state.playbackSession as any,
        keyboardInput: this.dependencies.keyboardInput,
        onSyncConsolePanel: () => this.dependencies.exportOverlay?.syncConsolePanel(),
        onResetInteractionState: () => this.resetInteractionState(),
        handoffPreparedPlayAlong: (midi) => this.dependencies.appController.openPreparedPlayAlong(midi),
        resetPlaybackTelemetry: () => this.state.resetPlaybackTelemetry(),
      },
      exportOverlay: {
        services: ports.services,
        ui: ports.ui,
        navigation: ports.navigation,
        learnRuntimeRegistry: this.dependencies.learnRuntimeRegistry,
        displayPrefs: this.state.displayPrefs as any,
        playbackSession: this.state.playbackSession as any,
        liveNotes: this.dependencies.liveNotes,
        loopNotes: this.dependencies.loopNotes,
        liveLooper: this.dependencies.liveLooper,
        sessionRec: this.dependencies.sessionRec,
        exporterRef: {
          get current() { return self.state.currentExporter },
          set current(v) { self.state.currentExporter = v },
        },
        pendingSessionRef: {
          get current() { return self.state.pendingSession },
          set current(v) { self.state.pendingSession = v },
        },
        loadSessionMidi: (midi) => this.dependencies.midiFlow.loadSessionMidi(midi),
      },
      initialTheme: THEMES[this.state.themeIndex]!,
    })

    this.dependencies.setCoordinators({
      ui: runtimeUi.ui,
      ...coordinators,
    })

    // Phase 7: Application controller
    const appController = new AppApplicationController({
      services: ports.services,
      ui: ports.ui,
      navigation: ports.navigation,
      learnRuntimeRegistry: this.dependencies.learnRuntimeRegistry,
      displayPrefs: this.state.displayPrefs as any,
      playbackSession: this.state.playbackSession as any,
      keyboardInput: {
        enable: () => this.dependencies.keyboardInput.enable(),
      },
      fileFlows: {
        openFilePicker: (target) => this.openFilePicker(target),
        openSample: (sampleId, target) => this.dependencies.midiFlow.openSample(sampleId, target),
        openLocalMidi: (id, target) => this.dependencies.midiFlow.openLocal(id, target),
        enterLearn: (request) => this.dependencies.midiFlow.enterLearn(request),
      },
      resetInteractionState: () => this.resetInteractionState(),
      syncConsolePanel: () => this.dependencies.exportOverlay?.syncConsolePanel(),
    })

    this.dependencies.setAppController(appController)
    const actions = createActions(appController)

    // Phase 8: Learn runtime lifecycle
    this.learnRuntimeLifecycle = createLearnRuntimeLifecycle({
      registry: this.dependencies.learnRuntimeRegistry,
      syncConsolePanel: () => this.dependencies.exportOverlay?.syncConsolePanel(),
    })

    // Phase 9: Event wiring
    this.eventWiring = new RuntimeEventWiring(this.dependencies, this.state, this.lifecycle)
    const firstPlayLoggedRef = {
      get current() { return self.state.firstPlayLogged },
      set current(v: boolean) { self.state.firstPlayLogged = v },
    }

    this.eventWiring.wireEffects(
      createRuntimeEffectsOptions({
        ui: this.dependencies.ui,
        route: {
          currentTarget: () => getCurrentRouteTarget(),
          currentTelemetryMode: () => resolveRuntimeTelemetryMode(getCurrentRouteTarget()),
          syncConsolePanel: () => this.dependencies.exportOverlay.syncConsolePanel(),
          applyChordOverlayVisibility: () => this.dependencies.exportOverlay.applyChordOverlayVisibility(),
          handleLoadedMidiChange: () =>
            syncLoadedMidiForCurrentRoute({
              syncConsolePanel: () => this.dependencies.exportOverlay.syncConsolePanel(),
              currentRouteTarget: () => getCurrentRouteTarget(),
              enterPlayRoute: (options) => appController.enterPlayRoute(options),
            }),
        },
        playback: {
          store: this.store,
          clock: this.dependencies.clock,
          synth: this.dependencies.synth,
          liveLooper: this.dependencies.liveLooper,
          metronome: this.dependencies.metronome,
          sessionRec: this.dependencies.sessionRec,
          onTrackLoopTransition: (next) => this.dependencies.playback.trackLoopTransition(next),
          onResetLiveNotes: () => {
            this.dependencies.liveNotes.releaseAll(this.dependencies.clock.currentTime)
            this.dependencies.synth.liveReleaseAll()
          },
          onMaybeUpdateChordOverlay: (time) => this.dependencies.exportOverlay.maybeUpdateChordOverlay(time),
          onFirstPlaybackMilestone: () => {},
          onSpeedChange: (speed) => {
            this.dependencies.clock.speed = speed
            this.dependencies.synth.setSpeed(speed)
          },
          playbackMilestones: this.state.playbackMilestones,
          firstPlayLoggedRef,
          applyInstrumentLoading: (id) => this.dependencies.ui.setInstrumentMenuLoading(id),
        },
        midi: {
          input: this.dependencies.midiInput,
        },
      }),
    )

    this.eventWiring.wireInput(
      createRuntimeInputOptions({
        midi: { input: this.dependencies.midiInput },
        keyboard: {
          input: this.dependencies.keyboardInput,
          syncOctave: (octave) => this.dependencies.ui.syncOctave(octave),
        },
        touch: {
          canvas,
          getCurrentTime: () => this.dependencies.clock.currentTime,
          getStatus: () => this.store.state.status,
          resolvePitch: (clientX, clientY) =>
            this.dependencies.renderer.pitchAtClientPoint(clientX, clientY),
          primeInteractiveAudio: () => this.primeInteractiveAudio(),
        },
        bridge: {
          inputBus: this.dependencies.inputBus,
          performanceBus: this.dependencies.performanceBus,
          synth: this.dependencies.synth,
          liveNotes: this.dependencies.liveNotes,
          capture: this.dependencies.capture,
          getCurrentTime: () => this.dependencies.clock.currentTime,
          shouldCapturePerformance: () => routeCapturesLive(getCurrentRouteTarget()),
          onPedalUsed: (source) => {
            if (!this.state.firstPedalLogged) {
              this.state.markPedalUsed()
              track('pedal_used', { source })
            }
          },
          onLiveNoteOn: (evt) => this.handleLiveNoteOn(evt),
          onLiveNoteOff: (evt) => this.handleLiveNoteOff(evt),
        },
      }),
    )

    this.eventWiring.wireDomEvents({
      onVisibilityChange: this.onVisibilityChange,
      onWindowBlur: this.onWindowBlur,
      onFirstPointerDown: this.onFirstPointerDown,
      onFirstKeyDown: this.onFirstKeyDown,
    })

    // Phase 10: Learn factory
    this.learnFactory = new RuntimeLearnFactory(
      this.dependencies,
      this.state,
      this.lifecycle,
      overlay,
      () => this.learnRuntimeLifecycle,
    )

    scheduleRuntimeWarmup({
      preloadDefaultInstrument: () => this.dependencies.synth.preloadDefault(),
    })

    this.dependencies.ui.syncMidiStatus(
      this.dependencies.midiInput.status.value,
      this.dependencies.midiInput.deviceName.value,
    )

    void this.autoConnectMidi()
    return actions
  }

  private createControlsOptions() {
    return createBootstrapRuntimeUiControls({
      seek: (time) => {
        this.dependencies.synth.seek(time)
        this.dependencies.liveNotes.reset()
      },
      zoom: (pps) => this.dependencies.renderer.setZoom(pps),
      cycleTheme: () => this.dependencies.exportOverlay.cycleTheme(),
      connectMidi: () => this.connectMidi(),
      openTracks: () => this.dependencies.ui.toggleTrackPanel(),
      openExport: () => this.dependencies.exportOverlay.openExportModal(),
      hasLoadedMidi: () => this.store.state.loadedMidi !== null,
      setTranspose: (s) => this.dependencies.exportOverlay.handleTransposeChange(s),
      cycleInstrument: () => this.dependencies.exportOverlay.cycleInstrument(),
      cycleParticleStyle: () => this.dependencies.exportOverlay.cycleParticleStyle(),
      toggleLoop: () => this.dependencies.liveLooper.toggle(),
      getLoopLayerCount: () => this.dependencies.liveLooper.layerCount.value,
      clearLoop: () => this.dependencies.liveLooper.clear(),
      saveLoopAsMidi: () => this.dependencies.exportOverlay.saveLoopAsMidi(),
      undoLoop: () => this.dependencies.liveLooper.undo(),
      toggleMetronome: () => this.dependencies.metronome.toggle(),
      isMetronomeRunning: () => this.dependencies.metronome.running.value,
      setMetronomeBpm: (bpm) => this.dependencies.metronome.setBpm(bpm),
      getMetronomeBpm: () => this.dependencies.metronome.bpm.value,
      persistMetronomeBpm: (bpm) => this.preferences.stores.metronomeBpm.save(bpm),
      toggleSessionRecord: () => this.dependencies.exportOverlay.toggleSessionRecord(),
      toggleChordOverlay: () => this.dependencies.exportOverlay.toggleChordOverlay(),
      shiftOctave: (delta) => {
        if (delta < 0) this.dependencies.keyboardInput.shiftOctaveDown()
        else this.dependencies.keyboardInput.shiftOctaveUp()
      },
    })
  }

  private createOverlayUiOptions() {
    return createBootstrapRuntimeUiConsole({
      handleTransposeChange: (v) => this.dependencies.exportOverlay.handleTransposeChange(v),
      getLearnBaseKey: () =>
        this.dependencies.learnRuntimeRegistry.getConsoleStateProvider()?.getConsoleState().baseKey ?? null,
      getPlayBaseKey: () => this.state.baseMidi?.keySignature ?? null,
      includeLearnBaseKey: () => isLearnRouteTarget(getCurrentRouteTarget()),
      requestKeyboardModeChange: (mode, options) => {
        requestConsoleKeyboardModeChange({
          mode,
          coordinator: this.dependencies.keyboardModeCoordinator,
          activeMidi: options.activeMidi,
          onTranspose: options.onTranspose,
        })
      },
      getActiveMidi: () =>
        isLearnRouteTarget(getCurrentRouteTarget())
          ? (this.dependencies.learnRuntimeRegistry.getMidiBackedRuntime()?.getLoadedMidi() ?? null)
          : this.store.state.loadedMidi,
      setPitchLabelsVisible: (v) => this.dependencies.exportOverlay.setPitchLabelsVisible(v),
    })
  }

  createPlayAlongPageRuntime() {
    return this.learnFactory.createPlayAlongPageRuntime()
  }

  createExercisePageRuntime(options: CreateExercisePageRuntimeOptions) {
    return this.learnFactory.createExercisePageRuntime(options)
  }

  async prepareBenchPlayback(midi: MidiFile) {
    this.lifecycle.assertReady('prepareBenchPlayback')
    this.resetInteractionState()
    this.store.beginPlayLoad()
    this.dependencies.renderer.clearMidi()
    await this.dependencies.synth.load(midi)
    this.store.completePlayLoad(midi)
    this.dependencies.renderer.loadMidi(midi)
    this.dependencies.appController.enterPlayRoute({ skipAnalytics: true })
  }

  startBenchPlayback() {
    this.lifecycle.assertReady('startBenchPlayback')
    this.primeInteractiveAudio()
    this.dependencies.clock.play()
    this.store.setState('status', 'playing')
  }

  dispose() {
    this.lifecycle.dispose()
    this.dependencies.dispose()
  }

  private async connectMidi() {
    await connectRuntimeMidi({
      midiInput: this.dependencies.midiInput,
      primeInteractiveAudio: () => this.primeInteractiveAudio(),
      showError: (message) => showError(message),
    })
  }

  private async autoConnectMidi() {
    await this.dependencies.midiInput.requestAccess({ silent: true })
  }

  private openFilePicker(target?: 'play' | 'learn') {
    openRuntimeFilePicker({
      target,
      getCurrentRouteTarget: () => getCurrentRouteTarget(),
      getMidiPickerModal: () => this.midiPickerHandle.get(),
      midiFlow: this.dependencies.midiFlow,
      appController: this.dependencies.appController,
    })
  }

  private releaseAllLiveNotes() {
    this.dependencies.playback.releaseAllLiveNotes()
  }

  private resetInteractionState() {
    this.lifecycle.assertReady('resetInteractionState')
    this.dependencies.playback.resetInteractionState()
  }

  private primeInteractiveAudio() {
    this.lifecycle.assertReady('primeInteractiveAudio')
    if (this.state.audioPrimed) return
    this.state.markAudioPrimed()
    this.dependencies.clock.prime()
    this.dependencies.synth.primeLiveInput()
    window.removeEventListener('pointerdown', this.onFirstPointerDown)
    window.removeEventListener('keydown', this.onFirstKeyDown)
  }

  private deferToCtxTime(ctxTime: number, fn: () => void) {
    this.dependencies.playback.deferToCtxTime(ctxTime, fn)
  }

  private handleLiveNoteOn(evt: BusNoteEvent) {
    this.dependencies.playback.handleLiveNoteOn(evt)
  }

  private handleLiveNoteOff(evt: BusNoteEvent) {
    this.dependencies.playback.handleLiveNoteOff(evt)
  }
}
