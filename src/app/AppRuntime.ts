import { AppApplicationController } from '@/app/runtime/AppApplicationController'
import type { AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import { createAppPreferences } from '@/app/runtime/preferences'
import { syncLoadedMidiForCurrentRoute } from '@/app/runtime/routeEntry'
import type { AppShellHandles } from '@/app/runtime/types'
import loadingStyles from '@/app.module.css'
import { showError, showSuccess } from '@/components/common/Toast'
import { installViewportClassSync } from '@/components/common/utils'
import { ChordOverlay } from '@/components/playback/ChordOverlay'
import { ConsolePanel } from '@/components/playback/ConsolePanel'
import { Controls } from '@/components/playback/Controls'
import { CustomizeMenu } from '@/components/playback/CustomizeMenu'
import { DropZone } from '@/components/playback/DropZone'
import { InstrumentMenu } from '@/components/playback/InstrumentMenu'
import { TrackPanel } from '@/components/playback/TrackPanel'
import { ActiveLearnRuntimeRegistry } from '@/features/learn/runtime/ActiveLearnRuntimeRegistry'
import { ExercisePageRuntime } from '@/features/learn/runtime/ExercisePageRuntime'
import { PlayAlongPageRuntime } from '@/features/learn/runtime/PlayAlongPageRuntime'
import type {
  CreateExercisePageRuntimeOptions,
  LearnRuntimeHandle,
} from '@/features/learn/runtime/types'
import {
  categorizeMidiDevice,
  track,
  trackActivation,
  trackEvent,
  trackEventSettled,
} from '@/features/telemetry'
import { setLocale, t } from '@/i18n'
import { assertDefined, assertOnce, invariant } from '@/lib/assert'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import { MasterClock } from '@/lib/core/MasterClock'
import { lazyHandle } from '@/lib/lazyHandle'
import { transposeDeltaToTonic } from '@/lib/music/KeySignature'
import { setNextLiveOpts } from '@/pages/LivePage/liveEnterOptions'
import { Metronome } from '@/services/audio/Metronome'
import { SynthEngine } from '@/services/audio/SynthEngine'
// VideoExporter pulls Mediabunny; OfflineAudioRenderer pulls Tone + instruments.
// Both are dynamic-imported from startExport(). Import order matters: load the
// offline-audio module first when audio is needed 锟?do not block Tone on the
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
import { PARTICLE_STYLES } from '@/services/renderer/ParticleSystem'
import { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import { THEMES, type Theme } from '@/services/renderer/theme'
import type {
  DisplayPrefsState,
  LearnRuntimeRegistryPort,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import { ExportAndOverlayCoordinator } from '@/services/runtime/ExportAndOverlayCoordinator'
import { MidiFlowCoordinator } from '@/services/runtime/MidiFlowCoordinator'
import { PlaybackCoordinator } from '@/services/runtime/PlaybackCoordinator'
import { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import type { AppActions } from '@/stores/app/AppCtx'
import type { AppStore } from '@/stores/app/state'
import { watch } from '@/stores/app/watch'
import {
  getCurrentRouteTarget,
  navigateToTarget,
  subscribeCurrentRoute,
} from '@/stores/routing/routerBridge'
import {
  isLearnRouteTarget,
  isPlayRouteTarget,
  type RouteTarget,
  routeCapturesLive,
} from '@/stores/routing/routeTarget'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'
import { whenIdle } from './whenIdle'

// Total note count across all tracks 锟?the content-size signal attached to
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
  private runtimeState!: DisplayPrefsState
  private exporterRef!: { current: VideoExporter | null }
  private pendingSessionRef!: { current: { events: CapturedEvent[]; duration: number } | null }
  private keyboardModeCoordinator!: KeyboardModeCoordinator
  private readonly learnRuntimeRegistry = new ActiveLearnRuntimeRegistry()
  private appController!: AppApplicationController
  // Lazy modals: race-safe lazy initialisation via lazyHandle 锟?each is
  // constructed at most once, even under concurrent get() calls.
  private postSessionHandle = lazyHandle(() =>
    import('@/components/export/PostSessionModal').then(({ PostSessionModal }) => {
      const m = new PostSessionModal(this.overlay)
      m.onAction = (action) => void this.exportOverlay.handleSessionAction(action)
      return m
    }),
  )
  private pendingSession: { events: CapturedEvent[]; duration: number } | null = null
  private instrumentMenu!: InstrumentMenu
  private activeMouseNote: number | null = null
  dropzone!: DropZone
  private midiPickerHandle = lazyHandle(() =>
    import('@/components/export/MidiPickerModal').then(({ MidiPickerModal }) => {
      const m = new MidiPickerModal(this.overlay)
      return m
    }),
  )
  private controls!: Controls
  private consolePanel!: ConsolePanel
  trackPanel!: TrackPanel
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
  private chordOverlay!: ChordOverlay
  private customizeMenu!: CustomizeMenu
  // Shared handles passed into subsystems (Controls today, mode controllers and
  // exercises in follow-up tasks). Assembled once in init() from this.clock,
  // this.synth, etc. so the constructor list stays authoritative.
  // Public so `createApp()` can thread `services`/`store` into AppCtx.
  services!: AppServices
  readonly store: AppStore

  constructor(store: AppStore) {
    this.store = store
    const thisApp = this
    this.runtimeState = this.createDisplayPrefsState()
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
  // Learn module graph (LearnHub, ExerciseRunner, IntervalsEngine, 锟? into
  // the bundle, so we defer construction to first use. The mode context is
  // captured at boot so the lazy constructor doesn't need to re-derive it.
  private loadingEl: HTMLElement | null = null
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

  private currentTelemetryMode(): 'play' | 'live' | 'learn' {
    const target = this.currentRouteTarget()
    if (!target) return 'play'
    switch (target.kind) {
      case 'learn-hub':
      case 'exercise':
        return 'learn'
      default:
        return target.kind
    }
  }

  private currentOpenTarget(explicit?: 'play' | 'learn'): 'play' | 'learn' {
    if (explicit) return explicit
    return isLearnRouteTarget(this.currentRouteTarget()) ? 'learn' : 'play'
  }

  private navigateToLiveTarget(primeAudio = true): void {
    setNextLiveOpts({ primeAudio })
    navigateToTarget({ kind: 'live' })
  }

  private createRuntimeServicesCtx(): RuntimeServicesCtx {
    const app = this
    return {
      get clock() {
        return app.clock
      },
      get synth() {
        return app.synth
      },
      get metronome() {
        return app.metronome
      },
      get renderer() {
        return app.renderer
      },
      get input() {
        return app.inputBus
      },
      get keyboardMode() {
        return app.keyboardModeCoordinator
      },
      primeInteractiveAudio() {
        app.primeInteractiveAudio()
      },
    }
  }

  private createRuntimeUiPort(): RuntimeUiPort {
    const app = this
    return {
      showLoading() {
        app.showLoading()
      },
      hideLoading() {
        app.hideLoading()
      },
      showError(message) {
        app.showError(message)
      },
      showSuccess(message) {
        app.showSuccess(message)
      },
      closeTransientOverlays() {
        app.closeTransientOverlays()
      },
      async openExportModal() {
        const modal = await app.exportHandle.get()
        modal.open()
      },
      peekExportModal() {
        return app.exportHandle.peek()
      },
      async openPostSession(duration, noteCount) {
        const modal = await app.postSessionHandle.get()
        modal.open(duration, noteCount)
      },
      closePostSession() {
        app.postSessionHandle.peek()?.close()
      },
      async openMidiPicker(options) {
        const modal = await app.midiPickerHandle.get()
        modal.open(options)
      },
      closeMidiPicker() {
        app.midiPickerHandle.peek()?.close()
      },
      renderTrackPanel(midi) {
        app.ui.renderTrackPanel(midi)
      },
      closeTrackPanel() {
        app.trackPanel.close()
      },
      hideDropzone() {
        app.ui.hideDropzone()
      },
      showDropzone() {
        app.ui.showDropzone()
      },
      setLearnFileName(name) {
        app.ui.setLearnFileName(name)
      },
      updateConsoleState(enabled, baseKey, current, keyboardMode, pitchLabelsVisible) {
        app.ui.updateConsoleState(enabled, baseKey, current, keyboardMode, pitchLabelsVisible)
      },
      closeConsole() {
        app.ui.closeConsole()
      },
      setTheme(theme, index) {
        app.ui.setTheme(theme, index)
      },
      setParticle(index) {
        app.ui.setParticle(index)
      },
      setChord(on) {
        app.ui.setChord(on)
      },
      setChordVisible(visible) {
        app.ui.setChordVisible(visible)
      },
      updateChord(reading) {
        app.ui.updateChord(reading)
      },
      isChordVisible() {
        return app.ui.chordVisible
      },
      setInstrumentLabel(name) {
        app.ui.setInstrumentLabel(name)
      },
      setCurrentInstrument(id) {
        app.ui.setCurrentInstrument(id)
      },
    }
  }

  private createRuntimeNavigationPort(): RuntimeNavigationPort {
    const app = this
    return {
      getCurrentTarget() {
        return app.currentRouteTarget()
      },
      navigate(target, options) {
        navigateToTarget(target, options)
      },
      enterLive(primeAudio = true) {
        setNextLiveOpts({ primeAudio })
        navigateToTarget({ kind: 'live' })
      },
    }
  }

  private createLearnRuntimeRegistryPort(): LearnRuntimeRegistryPort {
    return this.learnRuntimeRegistry
  }

  private createDisplayPrefsState(): DisplayPrefsState {
    const app = this
    return {
      get baseMidi() {
        return app.baseMidi
      },
      set baseMidi(value) {
        app.baseMidi = value
      },
      get transposeSemitones() {
        return app.transposeSemitones
      },
      set transposeSemitones(value) {
        app.transposeSemitones = value
      },
      get pitchLabelsVisible() {
        return app.pitchLabelsVisible
      },
      set pitchLabelsVisible(value) {
        app.pitchLabelsVisible = value
      },
      get chordOverlayOn() {
        return app.chordOverlayOn
      },
      set chordOverlayOn(value) {
        app.chordOverlayOn = value
      },
      get currentThemeIndex() {
        return app.themeIndex
      },
      set currentThemeIndex(value) {
        app.themeIndex = value
      },
      get currentInstrumentIndex() {
        return app.instrumentIndex
      },
      set currentInstrumentIndex(value) {
        app.instrumentIndex = value
      },
      get currentParticleIndex() {
        return app.particleIndex
      },
      set currentParticleIndex(value) {
        app.particleIndex = value
      },
      saveThemeIndex(value) {
        app.preferences.stores.themeIndex.save(value)
      },
      saveInstrumentIndex(value) {
        app.preferences.stores.instrumentIndex.save(value)
      },
      saveParticleIndex(value) {
        app.preferences.stores.particleIndex.save(value)
      },
      saveChordOverlay(value) {
        app.preferences.stores.chordOverlay.save(value)
      },
      savePitchLabels(value) {
        app.preferences.stores.pitchLabels.save(value)
      },
    }
  }

  private createPlaybackSessionState(): PlaybackSessionState {
    const app = this
    return {
      get state() {
        return {
          loadedMidi: app.store.state.loadedMidi,
          status: app.store.state.status,
          currentTime: app.store.state.currentTime,
          duration: app.store.state.duration,
          volume: app.store.state.volume,
          speed: app.store.state.speed,
        }
      },
      setState(key, value) {
        app.store.setState(key, value)
      },
      get hasLoadedFile() {
        return app.store.hasLoadedFile
      },
      enterPlayLanding() {
        app.store.enterPlayLanding()
      },
      beginPlayLoad() {
        app.store.beginPlayLoad()
      },
      completePlayLoad(midi) {
        app.store.completePlayLoad(midi)
      },
      replaceLoadedMidi(midi) {
        app.store.replaceLoadedMidi(midi)
      },
      enterPlay(resetTime) {
        return app.store.enterPlay(resetTime)
      },
      enterLive(resetTime) {
        app.store.enterLive(resetTime)
      },
      setStatus(value) {
        app.store.setState('status', value)
      },
    }
  }

  private createApplicationController(): AppApplicationController {
    return new AppApplicationController({
      services: this.createRuntimeServicesCtx(),
      ui: this.createRuntimeUiPort(),
      navigation: this.createRuntimeNavigationPort(),
      learnRuntimeRegistry: this.createLearnRuntimeRegistryPort(),
      displayPrefs: this.createDisplayPrefsState(),
      playbackSession: this.createPlaybackSessionState(),
      keyboardInput: {
        enable: () => this.keyboardInput.enable(),
      },
      fileFlows: {
        openFilePicker: (target) => this.openFilePicker(target),
        openSample: (sampleId, target) => this.openSample(sampleId, target),
        openLocalMidi: (id, target) => this.openLocalMidi(id, target),
        enterLearn: (request) => this.midiFlow.enterLearn(request),
      },
      resetInteractionState: () => this.resetInteractionState(),
      syncConsolePanel: () => this.syncConsolePanel(),
    })
  }
  // Loop station one-shots, scoped to the page session. We want to know
  // whether users ever reach each step in the loop funnel, not count every
  // state flip 锟?the state machine toggles rapidly during overdub.
  // Sustain pedal state managed by LivePerformanceBus 锟?keyboard OR MIDI
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
  // dispose() so each Signal's listener set is cleared 锟?otherwise the
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

    this.liveLooper = new LiveLooper(
      this.clock,
      {
        onPlaybackNoteOn: (pitch, velocity, ctxTime) => {
          // Audio is sample-accurately scheduled via the AudioContext clock.
          this.synth.scheduleNoteOn(pitch, velocity, ctxTime)
          // Visuals and session capture fire at ~wall time by deferring the
          // work until ctxTime arrives. setTimeout jitter (~1锟? ms) is
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
      // Bar-snap when the metronome is running 锟?rounds loop length to the
      // nearest whole bar at current BPM (4/4). Off 锟?freeform length.
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
    this.appController = this.createApplicationController()
    const actions = createActions(this.appController)

    // Wire the LivePerformanceBus fan-out sinks. Audio and visual-key
    // feedback fire unconditionally (every route). Capture-mode sinks
    // (looper + session + particles) gate on route capabilities.
    this.registerUnsubs(
      'performance-bus',
      this.performanceBus.subscribeNotes(
        // Audio + visual: always fire so every key-press is heard and seen.
        (evt) => {
          this.synth.liveNoteOn(evt.pitch, evt.velocity)
          this.liveNotes.press(evt.pitch, evt.velocity, evt.clockTime)
        },
        (evt) => {
          this.synth.liveNoteOff(evt.pitch)
        },
      ),
      // Capture-mode note-off subscriber: looper + session recorder capture
      // every note-off (including pedal-sustained releases). Mode-gated so
      // Learn-mode practice doesn't pollute recordings.
      this.performanceBus.subscribeNotes(
        () => {},
        (evt) => {
          if (!routeCapturesLive(this.currentRouteTarget())) return
          // Synthetic pedal-up uses clockTime -1; SessionRecorder needs wall times.
          const t = evt.clockTime >= 0 ? evt.clockTime : this.clock.currentTime
          this.capture.captureNoteOff(evt.pitch, t)
        },
      ),
    )

    // Dropzone is shared across modes; its callbacks dispatch by the active
    // mode so Learn keeps its MIDI isolated from Play's.
    this.dropzone = new DropZone(
      overlay,
      (file, source) => {
        const target = this.currentOpenTarget()
        void this.midiFlow.openFile(file, source, target)
      },
      true,
    )

    this.controls = new Controls({
      container: overlay,
      services: this.services,
      actions,
      onSeek: (t) => {
        this.synth.seek(t)
        this.liveNotes.reset()
      },
      onZoom: (pps) => this.renderer.setZoom(pps),
      onThemeCycle: () => this.exportOverlay.cycleTheme(),
      onMidiConnect: () => void this.connectMidi(),
      onOpenTracks: () => this.trackPanel.toggle(),
      onRecord: () => {
        // First-time vs repeat opens are derivable in PostHog funnels via
        // "first occurrence per user" 锟?no need for a duplicate event.
        track('export_opened', { has_midi: this.store.state.loadedMidi !== null })
        this.exportOverlay.openExportModal()
      },
      onTransposeChange: (semitones: number) => this.exportOverlay.handleTransposeChange(semitones),
      onInstrumentCycle: () => this.exportOverlay.cycleInstrument(),
      onParticleCycle: () => this.exportOverlay.cycleParticleStyle(),
      onLoopToggle: () => this.liveLooper.toggle(),
      onLoopClear: () => {
        const layers = this.liveLooper.layerCount.value
        this.liveLooper.clear()
        if (layers > 0) track('loop_cleared', { layers })
      },
      onLoopSave: () => void this.exportOverlay.saveLoopAsMidi(),
      onLoopUndo: () => {
        const before = this.liveLooper.layerCount.value
        this.liveLooper.undo()
        if (before > 0) track('loop_undone', { layers_before: before })
      },
      onMetronomeToggle: () => {
        this.metronome.toggle()
        trackEvent('metronome_toggled', { on: this.metronome.running.value })
      },
      onMetronomeBpmChange: (bpm) => {
        this.metronome.setBpm(bpm)
        this.preferences.stores.metronomeBpm.save(this.metronome.bpm.value)
        trackEventSettled('tempo_changed', { bpm: this.metronome.bpm.value })
      },
      onSessionToggle: () => this.exportOverlay.toggleSessionRecord(),
      onChordToggle: () => this.exportOverlay.toggleChordOverlay(),
      onOctaveShift: (delta) => {
        if (delta < 0) this.keyboardInput.shiftOctaveDown()
        else this.keyboardInput.shiftOctaveUp()
      },
    })

    this.metronome.setBpm(this.preferences.stores.metronomeBpm.load())
    this.trackPanel = new TrackPanel(
      overlay,
      this.renderer,
      (id, enabled) => {
        this.synth.setTrackEnabled(id, enabled)
        trackEvent('track_toggled', { enabled })
      },
      () => this.openFilePicker(),
    )
    this.trackPanel.setTrigger(this.controls.tracksButton)
    this.consolePanel = new ConsolePanel(
      overlay,
      (value) => this.exportOverlay.handleTransposeChange(value),
      () => this.exportOverlay.handleTransposeChange(this.resolveResetToC()),
      (mode) => this.handleKeyboardModeChange(mode),
      (visible) => this.exportOverlay.setPitchLabelsVisible(visible),
    )
    this.keyboardModeCoordinator = new KeyboardModeCoordinator({
      initialMode: this.preferences.stores.keyboardMode61.load() ? '61' : '88',
      persistMode: (mode) => this.preferences.stores.keyboardMode61.save(mode === '61'),
      applyMode: (mode) => this.renderer.setKeyboardMode(mode),
      syncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
    })
    this.renderer.setKeyboardMode(this.keyboardMode)
    this.syncConsolePanel()

    this.instrumentMenu = new InstrumentMenu(this.controls.instrumentSlot, overlay)
    this.instrumentMenu.onSelect = (id) => this.exportOverlay.setInstrumentById(id)
    this.registerUnsubs(
      'instrument-loading',
      this.synth.loadingInstrument.subscribe((id) => {
        this.instrumentMenu.setLoading(id)
        this.controls.setInstrumentLoading(id !== null)
      }),
    )
    this.instrumentMenu.setLoading(this.synth.loadingInstrument.value)
    this.controls.setInstrumentLoading(this.synth.loadingInstrument.value !== null)

    // ExportModal / PostSessionModal / MidiPickerModal are constructed lazily
    // (see ensureXModal helpers further down) 锟?none of them are visible at
    // boot, and keeping them out of the initial chunk shaves ~835 LOC of JSX
    // off the first-paint bundle.

    this.chordOverlay = new ChordOverlay(this.controls.chordSlot)
    this.chordOverlayOn = this.preferences.stores.chordOverlay.load()
    // File mode actively plays a MIDI 锟?the chord chip would just narrate
    // what the user is already hearing without contributing to "play along"
    // affordances. Keep it scoped to live/home where it confirms what the
    // player is sounding.
    this.registerUnsubs(
      'chord-visibility-watch',
      watch(
        () => this.store.state.status,
        () => this.exportOverlay?.applyChordOverlayVisibility(),
      ),
    )
    this.registerUnsubs(
      'route-sync-effects',
      subscribeCurrentRoute(() => {
        this.exportOverlay?.applyChordOverlayVisibility()
        this.exportOverlay?.syncConsolePanel()
      }),
    )

    // Customization popover bundles theme / particles / chord toggle 锟?
    // collapses three topbar pills into a single trigger.
    this.customizeMenu = new CustomizeMenu(
      this.controls.customizeSlot,
      overlay,
      THEMES,
      PARTICLE_STYLES,
      {
        onSelectTheme: (idx) => this.exportOverlay.setThemeByIndex(idx),
        onSelectParticle: (idx) => this.exportOverlay.setParticleByIndex(idx),
        onToggleChord: () => this.exportOverlay.toggleChordOverlay(),
        // Locale change is rare, and almost every part of the UI was built
        // with the previous locale baked in via template literals. Reload
        // is the simplest correct path: persistence happens in setLocale,
        // boot picks it up, the next paint is fully translated. No stale
        // strings, no in-place re-render machinery to maintain.
        onSelectLocale: (code) => {
          void setLocale(code).then(() => window.location.reload())
        },
      },
    )
    this.customizeMenu.setChord(this.chordOverlayOn)

    this.ui = new RuntimeUiBridge({
      controls: this.controls,
      dropzone: this.dropzone,
      trackPanel: this.trackPanel,
      consolePanel: this.consolePanel,
      instrumentMenu: this.instrumentMenu,
      chordOverlay: this.chordOverlay,
      customizeMenu: this.customizeMenu,
    })

    const pushLoop = (): void =>
      this.ui.syncLoopState(this.liveLooper.state.value, this.liveLooper.layerCount.value)
    this.registerUnsubs(
      'loop-ui-sync',
      this.liveLooper.state.subscribe((s) => {
        this.trackLoopTransition(s)
        pushLoop()
      }),
      this.liveLooper.layerCount.subscribe(pushLoop),
    )
    pushLoop()

    const pushMetronome = (): void =>
      this.ui.syncMetronome(this.metronome.running.value, this.metronome.bpm.value)
    this.registerUnsubs(
      'metronome-ui-sync',
      this.metronome.running.subscribe(pushMetronome),
      this.metronome.bpm.subscribe(pushMetronome),
      this.metronome.beatCount.subscribe((count) => {
        if (count === 0) return
        const isDownbeat = (count - 1) % 4 === 0
        this.ui.pulseMetronomeBeat(isDownbeat)
      }),
    )
    pushMetronome()

    const pushSession = (): void =>
      this.ui.syncSessionRecording(this.sessionRec.recording.value, this.sessionRec.elapsed.value)
    this.registerUnsubs(
      'session-ui-sync',
      this.sessionRec.recording.subscribe(pushSession),
      this.sessionRec.elapsed.subscribe(pushSession),
      this.liveLooper.progress.subscribe((p) => this.ui.syncLoopProgress(p)),
    )
    pushSession()

    this.playback = new PlaybackCoordinator({
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
      enterLiveMode: (primeAudio = true) => this.navigateToLiveTarget(primeAudio),
      closeTransientOverlays: () => this.closeTransientOverlays(),
    })

    const servicesCtx = this.createRuntimeServicesCtx()
    const uiPort = this.createRuntimeUiPort()
    const navigationPort = this.createRuntimeNavigationPort()
    const learnRuntimeRegistryPort = this.createLearnRuntimeRegistryPort()
    const displayPrefs = this.runtimeState
    const playbackSession = this.createPlaybackSessionState()

    this.midiFlow = new MidiFlowCoordinator({
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
    })

    this.exportOverlay = new ExportAndOverlayCoordinator({
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
    })
    this.syncConsolePanel()
    this.applyChordOverlayVisibility()

    this.applyTheme(THEMES[this.themeIndex]!)
    this.exportOverlay.applyInstrument()
    this.exportOverlay.applyParticleStyle()

    // Idle-time warmups. None of these affect first paint 锟?they trade
    // background bandwidth for "feels instant" on first-click flows. All
    // share the default deadline; on a typical browser they fire in the
    // same idle frame ~150-300 ms after boot, kicking off network fetches
    // in parallel.
    //   锟?synth piano samples 锟?first-note latency
    //   锟?@tonejs/midi 锟?sample-card click + record-export
    //   锟?modal chunks 锟?first export / file-picker / post-session click
    //   锟?LearnController (only when Learn is enabled) 锟?first Learn entry
    whenIdle(() => this.synth.preloadDefault())
    whenIdle(() => void import('@tonejs/midi'))
    whenIdle(() => {
      void import('@/components/export/ExportModal')
      void import('@/components/export/PostSessionModal')
      void import('@/components/export/MidiPickerModal')
    })

    this.ui.syncMidiStatus(this.midiInput.status.value, '')

    this.registerUnsubs(
      'clock-effects',
      this.clock.subscribe((t) => {
        // Engagement milestones are mode-agnostic (watched 锟?0s counts as
        // a real user regardless of where the clock was ticking).
        for (const m of [30, 60, 120]) {
          if (t >= m && !this.playbackMilestones.has(m)) {
            this.playbackMilestones.add(m)
            const routeTarget = this.currentRouteTarget()
            track('playback_milestone', {
              seconds: m,
              mode: this.currentTelemetryMode(),
              route_kind: routeTarget?.kind ?? 'play',
            })
            if (m === 30) trackActivation('playback_30s')
          }
        }
        this.exportOverlay.maybeUpdateChordOverlay(t)
      }),
    )
    this.registerUnsubs(
      'store-watchers',
      watch(
        () => this.store.state.status,
        (status) => {
          this.exportOverlay.syncConsolePanel()
          // Drives the synth for Play/Live only. Learn runs its own status
          // signal on `LearnState` and drives the synth from `LearnController`
          // so the two modes never race for control of the scheduler.
          const routeTarget = this.currentRouteTarget()
          if (isPlayRouteTarget(routeTarget) && status === 'playing') {
            void this.synth.play(this.clock.currentTime)
            if (!this.firstPlayLogged) {
              this.firstPlayLogged = true
              const midi = this.store.state.loadedMidi
              track('first_play', {
                mode: this.currentTelemetryMode(),
                route_kind: routeTarget?.kind ?? 'play',
                duration_s: midi ? Math.round(midi.duration) : null,
              })
            }
          } else if (status === 'paused') {
            this.synth.pause()
            if (routeTarget?.kind === 'live') {
              this.liveNotes.releaseAll(this.clock.currentTime)
              this.synth.liveReleaseAll()
            }
          }
        },
      ),
      watch(
        () => this.store.state.loadedMidi,
        () => {
          this.handleLoadedMidiChange()
        },
      ),
      watch(
        () => this.store.state.volume,
        (v) => this.synth.setVolume(v),
      ),
      watch(
        () => this.store.state.speed,
        (s) => {
          this.clock.speed = s
          this.synth.setSpeed(s)
        },
      ),
    )

    // 閳光偓閳光偓 Live input wiring (MIDI device + computer keyboard) 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    // Each source re-publishes into the shared InputBus so downstream
    // consumers (the live-note handler here, and later exercise runners)
    // see one fan-out point instead of three. Pedal sources are kept
    // per-source because the bus merges them with an OR.
    this.registerUnsubs(
      'live-input-sources',
      this.midiInput.noteOn.subscribe((evt) => {
        if (evt) this.inputBus.emitNoteOn(evt, 'midi')
      }),
      this.midiInput.noteOff.subscribe((evt) => {
        if (evt) this.inputBus.emitNoteOff(evt, 'midi')
      }),
      this.midiInput.pedal.subscribe((down) => {
        this.inputBus.emitPedal(down, 'midi')
        if (down) {
          this.performanceBus.routePedalDown('midi')
          if (!this.firstPedalLogged) {
            this.firstPedalLogged = true
            track('pedal_used', { source: 'midi' })
          }
        } else {
          this.performanceBus.routePedalUp('midi')
        }
      }),
      this.keyboardInput.noteOn.subscribe((evt) => {
        if (evt) this.inputBus.emitNoteOn(evt, 'keyboard')
      }),
      this.keyboardInput.noteOff.subscribe((evt) => {
        if (evt) this.inputBus.emitNoteOff(evt, 'keyboard')
      }),
      this.keyboardInput.pedal.subscribe((down) => {
        this.inputBus.emitPedal(down, 'keyboard')
        if (down) {
          this.performanceBus.routePedalDown('keyboard')
          if (!this.firstPedalLogged) {
            this.firstPedalLogged = true
            track('pedal_used', { source: 'keyboard' })
          }
        } else {
          this.performanceBus.routePedalUp('keyboard')
        }
      }),
      this.keyboardInput.octave.subscribe((o) => this.ui.syncOctave(o)),
      this.inputBus.noteOn.subscribe((evt) => {
        if (evt) this.handleLiveNoteOn(evt)
      }),
      this.inputBus.noteOff.subscribe((evt) => {
        if (evt) this.handleLiveNoteOff(evt)
      }),
    )

    // Mouse/touch on the on-screen keyboard 锟?down to press, move to slide
    // between keys (glissando), up/cancel/leave to release.
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
    canvas.addEventListener('pointermove', this.onCanvasPointerMove)
    canvas.addEventListener('pointerup', this.onCanvasPointerUp)
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp)
    canvas.addEventListener('pointerleave', this.onCanvasPointerUp)

    // Update MIDI button whenever either status or device name changes.
    // Reading the *other* signal's current value avoids a stale-name flash.
    this.registerUnsubs(
      'midi-status-watchers',
      this.midiInput.status.subscribe((status) => {
        this.ui.syncMidiStatus(status, this.midiInput.deviceName.value)
        if (status === 'connected') {
          // Vendor enum instead of raw device name 锟?cardinality-friendly and
          // avoids leaking user-customised device labels.
          track('midi_device_connected', {
            vendor: categorizeMidiDevice(this.midiInput.deviceName.value),
          })
        }
      }),
      this.midiInput.deviceName.subscribe((name) => {
        this.ui.syncMidiStatus(this.midiInput.status.value, name)
      }),
    )

    // Release all held notes when the page loses focus (prevents stuck notes)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('blur', this.onWindowBlur)
    window.addEventListener('pointerdown', this.onFirstPointerDown, { passive: true })
    window.addEventListener('keydown', this.onFirstKeyDown, { passive: true })

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
  // layer (overdubbing 锟?playing). Skipping transitions that just return to
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

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (this.store.state.status === 'exporting') return
    const pitch = this.renderer.pitchAtClientPoint(e.clientX, e.clientY)
    if (pitch === null) return

    this.primeInteractiveAudio()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    e.preventDefault()

    if (this.activeMouseNote !== null) {
      this.inputBus.emitNoteOff(
        { pitch: this.activeMouseNote, velocity: 0, clockTime: this.clock.currentTime },
        'touch',
      )
    }
    this.activeMouseNote = pitch
    this.inputBus.emitNoteOn({ pitch, velocity: 0.8, clockTime: this.clock.currentTime }, 'touch')
  }

  private onCanvasPointerMove = (e: PointerEvent): void => {
    // Only react while the user is actively pressing 锟?this is the glissando
    // path, not a hover state.
    if (this.activeMouseNote === null) return
    if (this.store.state.status === 'exporting') return
    const pitch = this.renderer.pitchAtClientPoint(e.clientX, e.clientY)
    if (pitch === null || pitch === this.activeMouseNote) return
    const prev = this.activeMouseNote
    this.activeMouseNote = pitch
    this.inputBus.emitNoteOff(
      { pitch: prev, velocity: 0, clockTime: this.clock.currentTime },
      'touch',
    )
    this.inputBus.emitNoteOn({ pitch, velocity: 0.8, clockTime: this.clock.currentTime }, 'touch')
  }

  private onCanvasPointerUp = (): void => {
    if (this.activeMouseNote === null) return
    const pitch = this.activeMouseNote
    this.activeMouseNote = null
    this.inputBus.emitNoteOff({ pitch, velocity: 0, clockTime: this.clock.currentTime }, 'touch')
  }

  private async connectMidi(): Promise<void> {
    this.primeInteractiveAudio()
    // Once a user denies the prompt, browsers remember the choice and
    // `requestMIDIAccess()` resolves silently 锟?clicking the button again
    // does nothing visible. Detect that case and surface a help message
    // so the user knows they need to reset the permission via the browser
    // (lock icon 锟?Site settings 锟?MIDI devices 锟?Allow).
    const wasBlocked = this.midiInput.status.value === 'blocked'
    track('midi_permission_requested', { was_blocked: wasBlocked })
    const ok = await this.midiInput.requestAccess()
    if (ok) {
      track('midi_permission_granted')
      return
    }
    if (this.midiInput.status.value === 'blocked') {
      track('midi_permission_denied', { was_blocked: wasBlocked })
      const msg = wasBlocked ? t('error.midi.permissionBlocked') : t('error.midi.permissionDenied')
      this.showError(msg)
    }
  }

  private async autoConnectMidi(): Promise<void> {
    await this.midiInput.requestAccess({ silent: true })
  }

  // Entry point for every "open MIDI" action. `target` is resolved at click
  // time so Play-vs-Learn routing stays stable during async picker flows.
  private openFilePicker(target?: 'play' | 'learn'): void {
    const resolveTarget = (): 'play' | 'learn' => this.currentOpenTarget(target)
    void this.midiPickerHandle.get().then((modal) => {
      modal.open({
        onFile: (file) => void this.midiFlow.openFile(file, 'picker', resolveTarget()),
        onSamplePlay: (id) => void this.openSample(id, 'play'),
        onSamplePractice: (id) =>
          void this.appController.enterLearnRequest({ kind: 'sample', sampleId: id }),
      })
    })
  }

  private async openSample(sampleId: string, target: 'play' | 'learn'): Promise<void> {
    await this.midiFlow.openSample(sampleId, target)
  }

  private async openLocalMidi(id: string, target: 'play' | 'learn'): Promise<void> {
    await this.midiFlow.openLocal(id, target)
  }

  createPlayAlongPageRuntime(): PlayAlongPageRuntime {
    this.assertActionReady('createPlayAlongPageRuntime')
    return new PlayAlongPageRuntime({
      services: this.services,
      overlayRoot: this.overlay,
      keyboardMode: this.keyboardModeCoordinator,
      setLearnFileName: (name) => this.controls.updateLearnFileName(name),
      updateConsolePanel: () => this.exportOverlay.syncConsolePanel(),
      onActivate: (runtime) => this.activateLearnRuntime(runtime),
      onDeactivate: (runtime) => this.deactivateLearnRuntime(runtime),
      consumePendingMidi: () => this.learnRuntimeRegistry.consumePreparedPlayAlongMidi(),
    })
  }

  createExercisePageRuntime(options: CreateExercisePageRuntimeOptions): ExercisePageRuntime {
    this.assertActionReady('createExercisePageRuntime')
    return new ExercisePageRuntime({
      services: this.services,
      overlayRoot: this.overlay,
      routeId: options.routeId,
      descriptor: options.descriptor,
      onNext: options.onNext,
      onActivate: (runtime) => this.activateLearnRuntime(runtime),
      onDeactivate: (runtime) => this.deactivateLearnRuntime(runtime),
    })
  }

  private activateLearnRuntime(runtime: LearnRuntimeHandle): void {
    this.learnRuntimeRegistry.register(runtime)
    this.syncConsolePanel()
  }

  private deactivateLearnRuntime(runtime: LearnRuntimeHandle): void {
    this.learnRuntimeRegistry.unregister(runtime)
    this.syncConsolePanel()
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

  private handleLoadedMidiChange(): void {
    syncLoadedMidiForCurrentRoute({
      syncConsolePanel: () => this.exportOverlay.syncConsolePanel(),
      currentRouteTarget: () => this.currentRouteTarget(),
      enterPlayRoute: (options) => this.appController.enterPlayRoute(options),
    })
  }

  // Schedules a UI side-effect to run at (roughly) the AudioContext time
  // `ctxTime`. Used so the visual press of a loop-played note lands with the
  // audio instead of up to 150 ms early when the scheduler runs ahead.
  private deferToCtxTime(ctxTime: number, fn: () => void): void {
    this.playback.deferToCtxTime(ctxTime, fn)
  }

  private syncConsolePanel(): void {
    this.exportOverlay?.syncConsolePanel()
  }

  private handleKeyboardModeChange(mode: KeyboardMode): void {
    const activeMidi = isLearnRouteTarget(this.currentRouteTarget())
      ? (this.learnRuntimeRegistry.getMidiBackedRuntime()?.getLoadedMidi() ?? null)
      : this.store.state.loadedMidi
    this.keyboardModeCoordinator.requestModeChange(mode, activeMidi, {
      onTranspose: (semitones) => this.exportOverlay.handleTransposeChange(semitones),
    })
  }

  private resolveResetToC(): number {
    const key = isLearnRouteTarget(this.currentRouteTarget())
      ? (this.learnRuntimeRegistry.getConsoleStateProvider()?.getConsoleState().baseKey ?? null)
      : (this.baseMidi?.keySignature ?? null)
    return transposeDeltaToTonic(key, 'C')
  }

  // 閳光偓閳光偓 Chord overlay 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  // Effective visibility = user's saved preference AND current mode supports it.
  // Play mode is excluded 锟?the chord readout is a "what am I playing?" cue,
  // not a passive playback annotation.
  private applyChordOverlayVisibility(): void {
    if (!this.exportOverlay) return
    this.exportOverlay.applyChordOverlayVisibility()
  }

  private resetInteractionState(): void {
    this.assertActionReady('resetInteractionState')
    this.playback.resetInteractionState()
  }

  // Dismiss every modal-style overlay so mode switches and fresh-load flows
  // don't leave a stale picker / export / post-session card floating over the
  // new surface. Idempotent 锟?`.close()` is a no-op when the modal is already
  // hidden. Popovers (instrument menu, customize) close themselves on the
  // outside click that triggered the transition.
  private closeTransientOverlays(): void {
    this.exportHandle.peek()?.close()
    this.postSessionHandle.peek()?.close()
    this.midiPickerHandle.peek()?.close()
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

  private applyTheme(theme: Theme): void {
    this.exportOverlay.applyTheme(theme)
  }

  private showLoading(): void {
    invariant(this.initialized, 'showLoading() called before app runtime booted')
    this.loadingEl = document.createElement('div')
    this.loadingEl.id = 'loading-overlay'
    this.loadingEl.className = loadingStyles.loadingOverlay!
    this.loadingEl.innerHTML = `
      <div class="${loadingStyles.loadingInner!}">
        <div class="${loadingStyles.loadingSpinner!}"></div>
        <div class="${loadingStyles.loadingText!}">Loading...</div>
      </div>
    `
    this.overlay.appendChild(this.loadingEl)
  }

  private hideLoading(): void {
    this.loadingEl?.remove()
    this.loadingEl = null
  }

  private showError(message: string): void {
    showError(message)
  }

  private showSuccess(message: string): void {
    showSuccess(message)
  }

  dispose(): void {
    assertOnce(this.disposed, 'App runtime dispose() cannot run more than once')
    invariant(this.initialized, 'App runtime dispose() called before boot completed')
    this.disposed = true
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
    this.releaseAllLiveNotes()
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('blur', this.onWindowBlur)
    window.removeEventListener('pointerdown', this.onFirstPointerDown)
    window.removeEventListener('keydown', this.onFirstKeyDown)
    this.renderer.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown)
    this.renderer.canvas.removeEventListener('pointermove', this.onCanvasPointerMove)
    this.renderer.canvas.removeEventListener('pointerup', this.onCanvasPointerUp)
    this.renderer.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp)
    this.renderer.canvas.removeEventListener('pointerleave', this.onCanvasPointerUp)
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
