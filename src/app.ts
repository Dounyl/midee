import { applyModeRequest } from './app/applyModeRequest'
import { ExportAndOverlayCoordinator } from './app/ExportAndOverlayCoordinator'
import { KeyboardModeCoordinator } from './app/KeyboardModeCoordinator'
import { MidiFlowCoordinator } from './app/MidiFlowCoordinator'
import { PlaybackCoordinator } from './app/PlaybackCoordinator'
import { RuntimeUiBridge } from './app/RuntimeUiBridge'
import type { ExportOverlayState } from './app/types'
import { Metronome } from './audio/Metronome'
import { INSTRUMENTS, SynthEngine } from './audio/SynthEngine'
import { MasterClock } from './core/clock/MasterClock'
import { type BusNoteEvent, InputBus } from './core/input/InputBus'
import { getKeyboardHeightProfile, type KeyboardMode } from './core/keyboardLayout'
import { lazyHandle } from './core/lazyHandle'
import { transposeDeltaToTonic } from './core/music/KeySignature'
import {
  createLivePerformanceBus,
  type LivePerformanceBus,
} from './core/performance/LivePerformanceBus'
import { booleanPersisted, indexPersisted, numberPersisted } from './core/persistence'
import type { AppServices } from './core/services'
// VideoExporter pulls Mediabunny; OfflineAudioRenderer pulls Tone + instruments.
// Both are dynamic-imported from startExport(). Import order matters: load the
// offline-audio module first when audio is needed 鈥?do not block Tone on the
// heavy VideoExporter chunk (see Promise.all removal below).
import type { VideoExporter } from './export/VideoExporter'
import { setLocale, t } from './i18n'
import { CaptureFanout } from './midi/CaptureFanout'
import { ComputerKeyboardInput } from './midi/ComputerKeyboardInput'
import { LiveLooper, type LiveLooperState } from './midi/LiveLooper'
import { LiveNoteStore } from './midi/LiveNoteStore'
import type { CapturedEvent } from './midi/MidiEncoding'
import { MidiInputManager } from './midi/MidiInputManager'
import { SessionRecorder } from './midi/SessionRecorder'
import type { LearnController } from './modes/LearnController'
import { setNextLiveOpts } from './modes/LiveMode'
import { MODE_CAPTURES_LIVE, type ModeContext } from './modes/ModeController'
import { PARTICLE_STYLES } from './renderer/ParticleSystem'
import { PianoRollRenderer } from './renderer/PianoRollRenderer'
import { THEMES, type Theme } from './renderer/theme'
import type {
  LearnEnterRequest,
  LibraryOpenRequest,
  ModeMountOptions,
  ShellMode,
} from './store/AppCtx'
import { type AppMode, type AppStore, SKIP_HOME_INTRO_STORAGE_KEY } from './store/state'
import { watch } from './store/watch'
import {
  categorizeMidiDevice,
  track,
  trackActivation,
  trackEvent,
  trackEventSettled,
} from './telemetry'
import { ChordOverlay } from './ui/ChordOverlay'
import { ConsolePanel } from './ui/ConsolePanel'
import { Controls } from './ui/Controls'
import { CustomizeMenu } from './ui/CustomizeMenu'
import { DropZone } from './ui/DropZone'
import { InstrumentMenu } from './ui/InstrumentMenu'
import { KeyboardModeSuggestionModal } from './ui/KeyboardModeSuggestionModal'
import { KeyboardResizer } from './ui/KeyboardResizer'
import { showError, showSuccess } from './ui/Toast'
import { TrackPanel } from './ui/TrackPanel'
import { installViewportClassSync } from './ui/utils'
import { whenIdle } from './whenIdle'

// Total note count across all tracks 鈥?the content-size signal attached to
// midi_loaded so we can tie which pieces drive retention. Structurally typed
// to avoid coupling this helper to the MidiFile import.
export class App {
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
  private runtimeState!: ExportOverlayState
  private exporterRef!: { current: VideoExporter | null }
  private pendingSessionRef!: { current: { events: CapturedEvent[]; duration: number } | null }
  private keyboardModeCoordinator!: KeyboardModeCoordinator
  // Lazy modals: race-safe lazy initialisation via lazyHandle 鈥?each is
  // constructed at most once, even under concurrent get() calls.
  private postSessionHandle = lazyHandle(() =>
    import('./ui/PostSessionModal').then(({ PostSessionModal }) => {
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
    import('./ui/MidiPickerModal').then(({ MidiPickerModal }) => {
      const m = new MidiPickerModal(this.overlay)
      return m
    }),
  )
  private controls!: Controls
  private consolePanel!: ConsolePanel
  private keyboardModeModal!: KeyboardModeSuggestionModal
  trackPanel!: TrackPanel
  private exportHandle = lazyHandle(() =>
    import('./ui/ExportModal').then(({ ExportModal }) => {
      const m = new ExportModal(this.overlay)
      m.onStart = (settings) => void this.exportOverlay.startExport(settings)
      m.onCancel = () => this.exportOverlay.cancelExport()
      return m
    }),
  )
  // Captured in init() so the lazy ensureXModal() helpers can construct
  // without re-querying the DOM.
  private overlay!: HTMLElement
  private kbdResizer!: KeyboardResizer
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
    this.runtimeState = {
      get baseMidi() {
        return thisApp.baseMidi
      },
      set baseMidi(value) {
        thisApp.baseMidi = value
      },
      get transposeSemitones() {
        return thisApp.transposeSemitones
      },
      set transposeSemitones(value) {
        thisApp.transposeSemitones = value
      },
      get pitchLabelsVisible() {
        return thisApp.pitchLabelsVisible
      },
      set pitchLabelsVisible(value) {
        thisApp.pitchLabelsVisible = value
      },
      get chordOverlayOn() {
        return thisApp.chordOverlayOn
      },
      set chordOverlayOn(value) {
        thisApp.chordOverlayOn = value
      },
      get currentThemeIndex() {
        return thisApp.themeIndex
      },
      set currentThemeIndex(value) {
        thisApp.themeIndex = value
      },
      get currentInstrumentIndex() {
        return thisApp.instrumentIndex
      },
      set currentInstrumentIndex(value) {
        thisApp.instrumentIndex = value
      },
      get currentParticleIndex() {
        return thisApp.particleIndex
      },
      set currentParticleIndex(value) {
        thisApp.particleIndex = value
      },
    }
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
  // Learn module graph (LearnHub, ExerciseRunner, IntervalsEngine, 鈥? into
  // the bundle, so we defer construction to first use. The mode context is
  // captured at boot so the lazy constructor doesn't need to re-derive it.
  private learnControllerHandle = lazyHandle(() =>
    import('./modes/LearnController').then(({ LearnController }) => {
      const c = new LearnController(this.modeContext)
      return c
    }),
  )
  private modeContext!: ModeContext
  private loadingEl: HTMLElement | null = null
  private currentExporter: VideoExporter | null = null
  private baseMidi: import('./core/midi/types').MidiFile | null = null
  private transposeSemitones = 0
  private chordOverlayOn = false
  private pitchLabelsVisible = pitchLabelsStore.load()

  private themeIndex = themeIndexStore.load()
  private instrumentIndex = instrumentIndexStore.load()
  private particleIndex = particleIndexStore.load()
  private audioPrimed = false
  // Analytics one-shot flags. Reset when a new file is loaded so a user
  // who opens MIDI A then MIDI B gets `first_play` events for both.
  private firstPlayLogged = false
  private firstPedalLogged = false
  private playbackMilestones = new Set<number>()
  // Loop station one-shots, scoped to the page session. We want to know
  // whether users ever reach each step in the loop funnel, not count every
  // state flip 鈥?the state machine toggles rapidly during overdub.
  // Sustain pedal state managed by LivePerformanceBus 鈥?keyboard OR MIDI
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
  // dispose() so each Signal's listener set is cleared 鈥?otherwise the
  // captured `this` leaks for the lifetime of the surrounding signals.
  private unsubs: Array<() => void> = []

  private get keyboardMode(): KeyboardMode {
    return this.keyboardModeCoordinator?.getMode() ?? (keyboardModeStore.load() ? '61' : '88')
  }

  async init(): Promise<void> {
    const canvas = document.querySelector<HTMLCanvasElement>('#pianoroll')!
    const overlay = document.querySelector<HTMLElement>('#ui-overlay')!
    this.overlay = overlay

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
          // work until ctxTime arrives. setTimeout jitter (~1鈥? ms) is
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
      // Bar-snap when the metronome is running 鈥?rounds loop length to the
      // nearest whole bar at current BPM (4/4). Off 鈫?freeform length.
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

    // Wire the LivePerformanceBus fan-out sinks. Audio and visual-key
    // feedback fire unconditionally (every mode). Capture-mode sinks
    // (looper + session + particles) gate on MODE_CAPTURES_LIVE.
    this.unsubs.push(
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
          if (!MODE_CAPTURES_LIVE[this.store.state.mode]) return
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
        const target = this.store.state.mode === 'learn' ? 'learn' : 'play'
        void this.midiFlow.openFile(file, source, target)
      },
      () => this.enterLiveMode(),
      (sampleId) => {
        void this.openSample(sampleId, this.store.state.mode === 'learn' ? 'learn' : 'play')
      },
      (sampleId) => void this.enterLearnRequest({ kind: 'sample', sampleId }),
      () => this.requestMode('learn'),
      skipHomeIntroStore.load(),
      (next) => skipHomeIntroStore.save(next),
      this.store.state.mode !== 'home',
    )

    this.controls = new Controls({
      container: overlay,
      services: this.services,
      actions: {
        mode: {
          request: (mode) => this.requestMode(mode),
          mount: (mode, options) => this.mountMode(mode, options),
        },
        library: {
          open: (request) => this.openLibraryRequest(request),
        },
        learn: {
          mount: (signal) => this.mountLearnMode(signal),
          exit: () => this.exitLearnMode(),
          enter: (request) => this.enterLearnRequest(request),
        },
        session: {
          resetInteractionState: () => this.resetInteractionState(),
          primeInteractiveAudio: () => this.primeInteractiveAudio(),
        },
      },
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
        // "first occurrence per user" 鈥?no need for a duplicate event.
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
        metronomeBpmStore.save(this.metronome.bpm.value)
        trackEventSettled('tempo_changed', { bpm: this.metronome.bpm.value })
      },
      onSessionToggle: () => this.exportOverlay.toggleSessionRecord(),
      onChordToggle: () => this.exportOverlay.toggleChordOverlay(),
      onOctaveShift: (delta) => {
        if (delta < 0) this.keyboardInput.shiftOctaveDown()
        else this.keyboardInput.shiftOctaveUp()
      },
    })

    this.metronome.setBpm(metronomeBpmStore.load())
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
    this.keyboardModeModal = new KeyboardModeSuggestionModal(overlay)
    this.keyboardModeCoordinator = new KeyboardModeCoordinator({
      initialMode: keyboardModeStore.load() ? '61' : '88',
      modal: this.keyboardModeModal,
      persistMode: (mode) => keyboardModeStore.save(mode === '61'),
      applyMode: (mode) => this.renderer.setKeyboardMode(mode),
      syncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
    })
    this.renderer.setKeyboardMode(this.keyboardMode)
    this.syncConsolePanel()

    this.instrumentMenu = new InstrumentMenu(this.controls.instrumentSlot, overlay)
    this.instrumentMenu.onSelect = (id) => this.exportOverlay.setInstrumentById(id)
    this.unsubs.push(
      this.synth.loadingInstrument.subscribe((id) => {
        this.instrumentMenu.setLoading(id)
        this.controls.setInstrumentLoading(id !== null)
      }),
    )
    this.instrumentMenu.setLoading(this.synth.loadingInstrument.value)
    this.controls.setInstrumentLoading(this.synth.loadingInstrument.value !== null)

    // ExportModal / PostSessionModal / MidiPickerModal are constructed lazily
    // (see ensureXModal helpers further down) 鈥?none of them are visible at
    // boot, and keeping them out of the initial chunk shaves ~835 LOC of JSX
    // off the first-paint bundle.

    this.kbdResizer = new KeyboardResizer(
      overlay,
      () => this.renderer.currentKeyboardHeight,
      () => this.renderer.currentKeyboardMode,
      (px) => this.renderer.setKeyboardHeight(px),
      (mode) => getKeyboardHeightProfile(mode).desktop,
    )
    this.kbdResizer.restoreSaved()

    this.chordOverlay = new ChordOverlay(this.controls.chordSlot)
    this.chordOverlayOn = chordOverlayStore.load()
    // File mode actively plays a MIDI 鈥?the chord chip would just narrate
    // what the user is already hearing without contributing to "play along"
    // affordances. Keep it scoped to live/home where it confirms what the
    // player is sounding.
    this.unsubs.push(
      watch(
        () => this.store.state.mode,
        () => this.exportOverlay?.applyChordOverlayVisibility(),
      ),
    )

    // Customization popover bundles theme / particles / chord toggle 鈥?
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
      keyboardResizer: this.kbdResizer,
      chordOverlay: this.chordOverlay,
      customizeMenu: this.customizeMenu,
    })

    const pushLoop = (): void =>
      this.ui.syncLoopState(this.liveLooper.state.value, this.liveLooper.layerCount.value)
    this.unsubs.push(
      this.liveLooper.state.subscribe((s) => {
        this.trackLoopTransition(s)
        pushLoop()
      }),
      this.liveLooper.layerCount.subscribe(pushLoop),
    )
    pushLoop()

    const pushMetronome = (): void =>
      this.ui.syncMetronome(this.metronome.running.value, this.metronome.bpm.value)
    this.unsubs.push(
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
    this.unsubs.push(
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
      enterLiveMode: (primeAudio = true) => this.enterLiveMode(primeAudio),
      closeTransientOverlays: () => this.closeTransientOverlays(),
    })

    const runtimeDeps = {
      services: this.services,
      store: this.store,
      renderer: this.renderer,
      persistence: {
        themeIndex: themeIndexStore,
        instrumentIndex: instrumentIndexStore,
        particleIndex: particleIndexStore,
        metronomeBpm: metronomeBpmStore,
        chordOverlay: chordOverlayStore,
        pitchLabels: pitchLabelsStore,
        skipHomeIntro: skipHomeIntroStore,
      },
      ensureLearnController: () => this.ensureLearnController(),
      keyboardMode: this.keyboardModeCoordinator,
      primeInteractiveAudio: () => this.primeInteractiveAudio(),
      showLoading: () => this.showLoading(),
      hideLoading: () => this.hideLoading(),
      showError: (message: string) => this.showError(message),
      showSuccess: (message: string) => this.showSuccess(message),
      resetPlaybackTelemetry: () => this.resetPlaybackTelemetry(),
      closeTransientOverlays: () => this.closeTransientOverlays(),
      modals: {
        exportHandle: this.exportHandle,
        postSessionHandle: this.postSessionHandle,
        midiPickerHandle: this.midiPickerHandle,
      },
    } as const

    this.midiFlow = new MidiFlowCoordinator({
      ...runtimeDeps,
      keyboardInput: this.keyboardInput,
      ui: this.ui,
      state: this.runtimeState,
      onSyncConsolePanel: () => this.exportOverlay?.syncConsolePanel(),
      onResetInteractionState: () => this.resetInteractionState(),
    })

    this.exportOverlay = new ExportAndOverlayCoordinator({
      ...runtimeDeps,
      store: this.store,
      renderer: this.renderer,
      liveNotes: this.liveNotes,
      loopNotes: this.loopNotes,
      liveLooper: this.liveLooper,
      sessionRec: this.sessionRec,
      ui: this.ui,
      state: this.runtimeState,
      exporterRef: this.exporterRef,
      pendingSessionRef: this.pendingSessionRef,
      loadSessionMidi: (midi) => this.midiFlow.loadSessionMidi(midi),
      metronomeBpm: () => this.metronomeBpm(),
      isTransposeEnabled: () => this.isTransposeEnabled(),
      getLearnConsoleState: () => this.learnControllerHandle.peek()?.getConsoleState() ?? null,
      keyboardMode: this.keyboardModeCoordinator,
    })
    this.syncConsolePanel()
    this.applyChordOverlayVisibility()

    this.applyTheme(THEMES[this.themeIndex]!)
    this.exportOverlay.applyInstrument()
    this.exportOverlay.applyParticleStyle()

    // Idle-time warmups. None of these affect first paint 鈥?they trade
    // background bandwidth for "feels instant" on first-click flows. All
    // share the default deadline; on a typical browser they fire in the
    // same idle frame ~150-300 ms after boot, kicking off network fetches
    // in parallel.
    //   鈥?synth piano samples 鈫?first-note latency
    //   鈥?@tonejs/midi 鈫?sample-card click + record-export
    //   鈥?modal chunks 鈫?first export / file-picker / post-session click
    //   鈥?LearnController (only when Learn is enabled) 鈫?first Learn entry
    whenIdle(() => this.synth.preloadDefault())
    whenIdle(() => void import('@tonejs/midi'))
    whenIdle(() => {
      void import('./ui/ExportModal')
      void import('./ui/PostSessionModal')
      void import('./ui/MidiPickerModal')
    })
    whenIdle(() => void this.ensureLearnController())

    this.ui.syncMidiStatus(this.midiInput.status.value, '')

    this.unsubs.push(
      this.clock.subscribe((t) => {
        // Engagement milestones are mode-agnostic (watched 鈮?0s counts as
        // a real user regardless of where the clock was ticking).
        for (const m of [30, 60, 120]) {
          if (t >= m && !this.playbackMilestones.has(m)) {
            this.playbackMilestones.add(m)
            track('playback_milestone', { seconds: m, mode: this.store.state.mode })
            if (m === 30) trackActivation('playback_30s')
          }
        }
        this.exportOverlay.maybeUpdateChordOverlay(t)
      }),
    )
    this.unsubs.push(
      watch(
        () => this.store.state.status,
        (status) => {
          this.exportOverlay.syncConsolePanel()
          // Drives the synth for Play/Live only. Learn runs its own status
          // signal on `LearnState` and drives the synth from `LearnController`
          // so the two modes never race for control of the scheduler.
          const mode = this.store.state.mode
          if (mode === 'play' && status === 'playing') {
            void this.synth.play(this.clock.currentTime)
            if (!this.firstPlayLogged) {
              this.firstPlayLogged = true
              const midi = this.store.state.loadedMidi
              track('first_play', {
                mode,
                duration_s: midi ? Math.round(midi.duration) : null,
              })
            }
          } else if (status === 'paused') {
            this.synth.pause()
            if (mode === 'live') {
              this.liveNotes.releaseAll(this.clock.currentTime)
              this.synth.liveReleaseAll()
            }
          }
        },
      ),
      watch(
        () => this.store.state.loadedMidi,
        () => {
          this.exportOverlay.syncConsolePanel()
        },
      ),
      watch(
        () => this.store.state.mode,
        () => {
          this.exportOverlay.syncConsolePanel()
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

    // 鈹€鈹€ Live input wiring (MIDI device + computer keyboard) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    // Each source re-publishes into the shared InputBus so downstream
    // consumers (the live-note handler here, and later exercise runners)
    // see one fan-out point instead of three. Pedal sources are kept
    // per-source because the bus merges them with an OR.
    this.unsubs.push(
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

    // Mouse/touch on the on-screen keyboard 鈥?down to press, move to slide
    // between keys (glissando), up/cancel/leave to release.
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
    canvas.addEventListener('pointermove', this.onCanvasPointerMove)
    canvas.addEventListener('pointerup', this.onCanvasPointerUp)
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp)
    canvas.addEventListener('pointerleave', this.onCanvasPointerUp)

    // Update MIDI button whenever either status or device name changes.
    // Reading the *other* signal's current value avoids a stale-name flash.
    this.unsubs.push(
      this.midiInput.status.subscribe((status) => {
        this.ui.syncMidiStatus(status, this.midiInput.deviceName.value)
        if (status === 'connected') {
          // Vendor enum instead of raw device name 鈥?cardinality-friendly and
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

    this.modeContext = {
      services: this.services,
      overlay,
      trackPanel: this.trackPanel,
      dropzone: this.dropzone,
      keyboardInput: this.keyboardInput,
      midiInput: this.midiInput,
      resetInteractionState: () => this.resetInteractionState(),
      openFilePicker: (target) => this.openFilePicker(target),
      openLocalMidi: (id, target) => void this.openLocalMidi(id, target),
      primeInteractiveAudio: () => this.primeInteractiveAudio(),
      setLearnFileName: (name) => this.controls.updateLearnFileName(name),
      updateConsolePanel: () => this.exportOverlay.syncConsolePanel(),
      keyboardMode: this.keyboardModeCoordinator,
    }

    if (skipHomeIntroStore.load()) this.services.store.enterPlayLanding()
    else this.services.store.enterHome()
    void this.autoConnectMidi()
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
  // layer (overdubbing 鈫?playing). Skipping transitions that just return to
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
    if (this.store.state.mode === 'home') this.enterLiveMode(false)
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
    // Only react while the user is actively pressing 鈥?this is the glissando
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
    // `requestMIDIAccess()` resolves silently 鈥?clicking the button again
    // does nothing visible. Detect that case and surface a help message
    // so the user knows they need to reset the permission via the browser
    // (lock icon 鈫?Site settings 鈫?MIDI devices 鈫?Allow).
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
  openFilePicker(target?: 'play' | 'learn'): void {
    const resolveTarget = (): 'play' | 'learn' =>
      target ?? (this.store.state.mode === 'learn' ? 'learn' : 'play')
    void this.midiPickerHandle.get().then((modal) => {
      modal.open({
        onFile: (file) => void this.midiFlow.openFile(file, 'picker', resolveTarget()),
        onSamplePlay: (id) => void this.openSample(id, 'play'),
        onSamplePractice: (id) => void this.enterLearnRequest({ kind: 'sample', sampleId: id }),
      })
    })
  }

  ensureLearnController(): Promise<LearnController> {
    return this.learnControllerHandle.get()
  }

  async openSample(sampleId: string, target: 'play' | 'learn'): Promise<void> {
    await this.midiFlow.openSample(sampleId, target)
  }

  async openLocalMidi(id: string, target: 'play' | 'learn'): Promise<void> {
    await this.midiFlow.openLocal(id, target)
  }

  requestMode(mode: AppMode): void {
    if (mode === 'home') {
      this.enterHomeMode()
      return
    }
    if (this.midiFlow) {
      this.midiFlow.requestMode(mode)
      return
    }
    applyModeRequest(this.store, mode, {
      ensureLearnController: () => this.ensureLearnController(),
      enterLiveMode: () => this.enterLiveMode(),
      enterPlayMode: () => this.enterPlayMode(),
    })
  }

  enterLearnRequest(request: LearnEnterRequest): Promise<void> | void {
    return this.midiFlow.enterLearn(request)
  }

  async mountLearnMode(signal?: AbortSignal): Promise<void> {
    const controller = await this.ensureLearnController()
    if (signal?.aborted) return
    controller.enter()
  }

  exitLearnMode(): void {
    this.learnControllerHandle.peek()?.exit()
  }

  mountMode(mode: ShellMode, options: ModeMountOptions = {}): void {
    const { skipAnalytics = false } = options
    if (mode === 'home') {
      this.resetInteractionState()
      this.store.enterHome()
      this.renderer.clearMidi()
      this.trackPanel.close()
      this.dropzone.show()
      this.keyboardInput.enable()
      document.title = t('doc.title.home')
      return
    }
    if (mode === 'play') {
      const midi = this.store.state.loadedMidi
      const status = this.store.state.status
      if (!midi) {
        if (status === 'loading') return
        this.renderer.clearMidi()
        this.trackPanel.close()
        this.dropzone.hide()
        this.keyboardInput.enable()
        document.title = `midee - ${t('topStrip.mode.play.label')}`
        return
      }
      this.renderer.loadMidi(midi)
      this.trackPanel.render(midi)
      this.dropzone.hide()
      this.keyboardInput.enable()
      document.title = `${midi.name} - midee`
      if (!skipAnalytics) {
        const props = { duration_s: Math.round(midi.duration) }
        trackEvent('play_mode_entered', props)
        track('file_mode_entered', props)
      }
      return
    }
    if (mode === 'live') {
      this.resetInteractionState()
      this.renderer.clearMidi()
      this.trackPanel.close()
      this.dropzone.hide()
      this.keyboardInput.enable()
      document.title = t('doc.title.live')
      return
    }
  }

  openLibraryRequest(request: LibraryOpenRequest): Promise<void> | void {
    if (request.kind === 'picker') {
      this.openFilePicker(request.target)
      return
    }
    if (!request.entry) return
    if (request.target === 'learn') {
      if (request.entry.kind === 'local') {
        return this.enterLearnRequest({ kind: 'local', id: request.entry.id })
      }
      return this.enterLearnRequest({ kind: 'sample', sampleId: request.entry.id })
    }
    if (request.entry.kind === 'local') {
      return this.openLocalMidi(request.entry.id, request.target ?? 'play')
    }
    return this.openSample(request.entry.id, request.target ?? 'play')
  }

  // Thin delegators: each flips the store and lets Solid's mode shell run
  // the side effects (onMount in HomeMode/PlayMode/LiveMode/LearnMode).
  private enterHomeMode(): void {
    this.store.enterHome()
  }

  private enterLiveMode(primeAudio = true): void {
    setNextLiveOpts({ primeAudio })
    this.store.enterLive()
  }

  private enterPlayMode(): void {
    this.store.enterPlay()
  }

  // Schedules a UI side-effect to run at (roughly) the AudioContext time
  // `ctxTime`. Used so the visual press of a loop-played note lands with the
  // audio instead of up to 150 ms early when the scheduler runs ahead.
  private deferToCtxTime(ctxTime: number, fn: () => void): void {
    this.playback.deferToCtxTime(ctxTime, fn)
  }

  private metronomeBpm(): number {
    return this.metronome.bpm.value
  }

  private syncConsolePanel(): void {
    this.exportOverlay?.syncConsolePanel()
  }

  private isTransposeEnabled(): boolean {
    return (
      this.store.state.mode === 'play' &&
      this.baseMidi !== null &&
      this.store.state.status !== 'playing' &&
      this.store.state.status !== 'loading' &&
      this.store.state.status !== 'exporting'
    )
  }

  private handleKeyboardModeChange(mode: KeyboardMode): void {
    const activeMidi =
      this.store.state.mode === 'learn'
        ? (this.learnControllerHandle.peek()?.learnState.state.loadedMidi ?? null)
        : this.store.state.loadedMidi
    this.keyboardModeCoordinator.requestModeChange(mode, activeMidi, {
      onTranspose: (semitones) => this.exportOverlay.handleTransposeChange(semitones),
    })
  }

  private resolveResetToC(): number {
    const key =
      this.store.state.mode === 'learn'
        ? (this.learnControllerHandle.peek()?.getConsoleState().baseKey ?? null)
        : (this.baseMidi?.keySignature ?? null)
    return transposeDeltaToTonic(key, 'C')
  }

  // 鈹€鈹€ Chord overlay 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  // Effective visibility = user's saved preference AND current mode supports it.
  // Play mode is excluded 鈥?the chord readout is a "what am I playing?" cue,
  // not a passive playback annotation.
  private applyChordOverlayVisibility(): void {
    if (!this.exportOverlay) return
    this.exportOverlay.applyChordOverlayVisibility()
  }

  resetInteractionState(): void {
    this.playback.resetInteractionState()
  }

  // Dismiss every modal-style overlay so mode switches and fresh-load flows
  // don't leave a stale picker / export / post-session card floating over the
  // new surface. Idempotent 鈥?`.close()` is a no-op when the modal is already
  // hidden. Popovers (instrument menu, customize) close themselves on the
  // outside click that triggered the transition.
  private closeTransientOverlays(): void {
    this.exportHandle.peek()?.close()
    this.postSessionHandle.peek()?.close()
    this.midiPickerHandle.peek()?.close()
  }

  primeInteractiveAudio(): void {
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
    this.loadingEl = document.createElement('div')
    this.loadingEl.id = 'loading-overlay'
    this.loadingEl.innerHTML = `
      <div class="loading-inner">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading...</div>
      </div>
    `
    document.querySelector('#ui-overlay')!.appendChild(this.loadingEl)
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
    this.keyboardModeModal.dispose()
    this.ui.dispose()
    this.clock.dispose()
    this.renderer.destroy()
    this.synth.dispose()
  }
}

// User-preference persistence. Each entry exposes load()/save() backed by
// localStorage. Defined here (not in persistence.ts) because the defaults
// depend on runtime values 鈥?current theme list, instrument list, etc.
const themeIndexStore = indexPersisted(
  'midee.themeIndex',
  Math.max(
    0,
    THEMES.findIndex((t) => t.name === 'Sunset'),
  ),
  THEMES.length,
)
// New visitors default to Upright (1.2 MB of self-hosted samples) so first-load
// is fast. Returning users keep whatever they had, including Salamander Grand.
const instrumentIndexStore = indexPersisted(
  'midee.instrumentIndex',
  Math.max(
    0,
    INSTRUMENTS.findIndex((i) => i.id === 'upright'),
  ),
  INSTRUMENTS.length,
)
const particleIndexStore = indexPersisted(
  'midee.particleIndex',
  Math.max(
    0,
    PARTICLE_STYLES.findIndex((s) => s.id === 'embers'),
  ),
  PARTICLE_STYLES.length,
)
const metronomeBpmStore = numberPersisted('midee.metronomeBpm', 120, 40, 240)
// Chord readout defaults *on*: it's the headline live-mode cue. The
// boolean store treats "no preference" as the fallback (true), and only
// an explicit "false" turns it off.
const chordOverlayStore = booleanPersisted('midee.chordOverlay', true)
const pitchLabelsStore = booleanPersisted('midee.pitchLabels', false)
const keyboardModeStore = booleanPersisted('midee.keyboardMode61', false)
const skipHomeIntroStore = booleanPersisted(SKIP_HOME_INTRO_STORAGE_KEY, false)
