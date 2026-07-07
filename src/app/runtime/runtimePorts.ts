import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import type { ChordReading } from '@/lib/music/ChordDetector'
import type { InstrumentId } from '@/services/audio/instruments'
import type { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import type {
  DisplayPrefsState,
  ExportModalPort,
  MidiPickerOpenOptions,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import type { Theme } from '@/services/renderer/theme'
import type { AppStore, PlaybackStatus } from '@/stores/app/state'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export interface CreateRuntimeServicesCtxOptions {
  services: Pick<
    RuntimeServicesCtx,
    'clock' | 'synth' | 'metronome' | 'renderer' | 'input' | 'keyboardMode'
  >
  primeInteractiveAudio(): void
}

export function createRuntimeServicesCtx(
  options: CreateRuntimeServicesCtxOptions,
): RuntimeServicesCtx {
  return {
    ...options.services,
    primeInteractiveAudio() {
      options.primeInteractiveAudio()
    },
  }
}

export interface CreateRuntimeUiPortOptions {
  getUi(): RuntimeUiBridge
  showLoading(): void
  hideLoading(): void
  showError(message: string): void
  showSuccess(message: string): void
  closeTransientOverlays(): void
  openExportModal(): Promise<void>
  peekExportModal(): ExportModalPort | null
  openPostSession(duration: number, noteCount: number): Promise<void>
  closePostSession(): void
  openMidiPicker(options: MidiPickerOpenOptions): Promise<void>
  closeMidiPicker(): void
}

export function createRuntimeUiPort(options: CreateRuntimeUiPortOptions): RuntimeUiPort {
  return {
    showLoading() {
      options.showLoading()
    },
    hideLoading() {
      options.hideLoading()
    },
    showError(message) {
      options.showError(message)
    },
    showSuccess(message) {
      options.showSuccess(message)
    },
    closeTransientOverlays() {
      options.closeTransientOverlays()
    },
    async openExportModal() {
      await options.openExportModal()
    },
    peekExportModal() {
      return options.peekExportModal()
    },
    async openPostSession(duration, noteCount) {
      await options.openPostSession(duration, noteCount)
    },
    closePostSession() {
      options.closePostSession()
    },
    async openMidiPicker(openOptions) {
      await options.openMidiPicker(openOptions)
    },
    closeMidiPicker() {
      options.closeMidiPicker()
    },
    renderTrackPanel(midi) {
      options.getUi().renderTrackPanel(midi)
    },
    closeTrackPanel() {
      options.getUi().closeTrackPanel()
    },
    hideDropzone() {
      options.getUi().hideDropzone()
    },
    showDropzone() {
      options.getUi().showDropzone()
    },
    setLearnFileName(name) {
      options.getUi().setLearnFileName(name)
    },
    updateConsoleState(enabled, baseKey, current, keyboardMode, pitchLabelsVisible) {
      options
        .getUi()
        .updateConsoleState(enabled, baseKey, current, keyboardMode, pitchLabelsVisible)
    },
    closeConsole() {
      options.getUi().closeConsole()
    },
    setTheme(theme, index) {
      options.getUi().setTheme(theme, index)
    },
    setParticle(index) {
      options.getUi().setParticle(index)
    },
    setChord(on) {
      options.getUi().setChord(on)
    },
    setChordVisible(visible) {
      options.getUi().setChordVisible(visible)
    },
    updateChord(reading) {
      options.getUi().updateChord(reading)
    },
    isChordVisible() {
      return options.getUi().chordVisible
    },
    setInstrumentLabel(name) {
      options.getUi().setInstrumentLabel(name)
    },
    setCurrentInstrument(id) {
      options.getUi().setCurrentInstrument(id)
    },
  }
}

export interface CreateRuntimeNavigationPortOptions {
  getCurrentTarget(): RouteTarget | null
  navigate(target: RouteTarget, options?: { replace?: boolean }): void
  enterLive(primeAudio?: boolean): void
}

export function createRuntimeNavigationPort(
  options: CreateRuntimeNavigationPortOptions,
): RuntimeNavigationPort {
  return {
    getCurrentTarget() {
      return options.getCurrentTarget()
    },
    navigate(target, navigateOptions) {
      options.navigate(target, navigateOptions)
    },
    enterLive(primeAudio = true) {
      options.enterLive(primeAudio)
    },
  }
}

export interface CreateRuntimePortBundleOptions {
  services: CreateRuntimeServicesCtxOptions
  ui: CreateRuntimeUiPortOptions
  navigation: CreateRuntimeNavigationPortOptions
}

export function createRuntimePortBundle(options: CreateRuntimePortBundleOptions): {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
} {
  return {
    services: createRuntimeServicesCtx(options.services),
    ui: createRuntimeUiPort(options.ui),
    navigation: createRuntimeNavigationPort(options.navigation),
  }
}

export interface CreateDisplayPrefsStateOptions {
  getBaseMidi(): MidiFile | null
  setBaseMidi(value: MidiFile | null): void
  getTransposeSemitones(): number
  setTransposeSemitones(value: number): void
  getPitchLabelsVisible(): boolean
  setPitchLabelsVisible(value: boolean): void
  getChordOverlayOn(): boolean
  setChordOverlayOn(value: boolean): void
  getThemeIndex(): number
  setThemeIndex(value: number): void
  getInstrumentIndex(): number
  setInstrumentIndex(value: number): void
  getParticleIndex(): number
  setParticleIndex(value: number): void
  saveThemeIndex(value: number): void
  saveInstrumentIndex(value: number): void
  saveParticleIndex(value: number): void
  saveChordOverlay(value: boolean): void
  savePitchLabels(value: boolean): void
}

export function createDisplayPrefsState(
  options: CreateDisplayPrefsStateOptions,
): DisplayPrefsState {
  return {
    get baseMidi() {
      return options.getBaseMidi()
    },
    set baseMidi(value) {
      options.setBaseMidi(value)
    },
    get transposeSemitones() {
      return options.getTransposeSemitones()
    },
    set transposeSemitones(value) {
      options.setTransposeSemitones(value)
    },
    get pitchLabelsVisible() {
      return options.getPitchLabelsVisible()
    },
    set pitchLabelsVisible(value) {
      options.setPitchLabelsVisible(value)
    },
    get chordOverlayOn() {
      return options.getChordOverlayOn()
    },
    set chordOverlayOn(value) {
      options.setChordOverlayOn(value)
    },
    get currentThemeIndex() {
      return options.getThemeIndex()
    },
    set currentThemeIndex(value) {
      options.setThemeIndex(value)
    },
    get currentInstrumentIndex() {
      return options.getInstrumentIndex()
    },
    set currentInstrumentIndex(value) {
      options.setInstrumentIndex(value)
    },
    get currentParticleIndex() {
      return options.getParticleIndex()
    },
    set currentParticleIndex(value) {
      options.setParticleIndex(value)
    },
    saveThemeIndex(value) {
      options.saveThemeIndex(value)
    },
    saveInstrumentIndex(value) {
      options.saveInstrumentIndex(value)
    },
    saveParticleIndex(value) {
      options.saveParticleIndex(value)
    },
    saveChordOverlay(value) {
      options.saveChordOverlay(value)
    },
    savePitchLabels(value) {
      options.savePitchLabels(value)
    },
  }
}

export interface CreatePlaybackSessionStateOptions {
  store: Pick<
    AppStore,
    | 'state'
    | 'hasLoadedFile'
    | 'setState'
    | 'enterPlayLanding'
    | 'beginPlayLoad'
    | 'completePlayLoad'
    | 'replaceLoadedMidi'
    | 'enterPlay'
    | 'enterLive'
  >
}

export function createPlaybackSessionState(
  options: CreatePlaybackSessionStateOptions,
): PlaybackSessionState {
  return {
    get state() {
      return {
        loadedMidi: options.store.state.loadedMidi,
        status: options.store.state.status,
        currentTime: options.store.state.currentTime,
        duration: options.store.state.duration,
        volume: options.store.state.volume,
        speed: options.store.state.speed,
      }
    },
    setState(key, value) {
      options.store.setState(key, value)
    },
    get hasLoadedFile() {
      return options.store.hasLoadedFile
    },
    enterPlayLanding() {
      options.store.enterPlayLanding()
    },
    beginPlayLoad() {
      options.store.beginPlayLoad()
    },
    completePlayLoad(midi) {
      options.store.completePlayLoad(midi)
    },
    replaceLoadedMidi(midi) {
      options.store.replaceLoadedMidi(midi)
    },
    enterPlay(resetTime) {
      return options.store.enterPlay(resetTime)
    },
    enterLive(resetTime) {
      options.store.enterLive(resetTime)
    },
    setStatus(value: PlaybackStatus) {
      options.store.setState('status', value)
    },
  }
}
