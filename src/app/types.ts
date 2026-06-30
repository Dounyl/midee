import type { LazyHandle } from '../core/lazyHandle'
import type { MidiFile } from '../core/midi/types'
import type { AppServices } from '../core/services'
import type { LearnController } from '../modes/LearnController'
import type { PianoRollRenderer } from '../renderer/PianoRollRenderer'
import type { Theme } from '../renderer/theme'
import type { AppMode, AppStore } from '../store/state'
import type { ExportSettings } from '../ui/ExportModal'
import type { SessionAction } from '../ui/PostSessionModal'
import type { KeyboardModeCoordinator } from './KeyboardModeCoordinator'

export type MidiOpenTarget = 'play' | 'learn'
export type MidiOpenSource = 'drag' | 'picker' | 'sample'
export type ModeRequest = Exclude<AppMode, 'home'>

export interface AppPersistence {
  themeIndex: { load(): number; save(value: number): void }
  instrumentIndex: { load(): number; save(value: number): void }
  particleIndex: { load(): number; save(value: number): void }
  metronomeBpm: { load(): number; save(value: number): void }
  chordOverlay: { load(): boolean; save(value: boolean): void }
  pitchLabels: { load(): boolean; save(value: boolean): void }
  skipHomeIntro: { load(): boolean; save(value: boolean): void }
}

export interface AppModalHandles {
  exportHandle: LazyHandle<{
    open(): void
    close(): void
    updateProgress(stage: string, pct: number): void
    setRenderAudioProgressMode(detailed: boolean): void
  }>
  postSessionHandle: LazyHandle<{
    open(duration: number, noteCount: number): void
    close(): void
  }>
  midiPickerHandle: LazyHandle<{
    open(options: {
      onFile: (file: File) => void
      onSamplePlay: (id: string) => void
      onSamplePractice: (id: string) => void
    }): void
    close(): void
  }>
}

export interface AppRuntimeDeps {
  services: AppServices
  store: AppStore
  renderer: PianoRollRenderer
  persistence: AppPersistence
  ensureLearnController: () => Promise<LearnController>
  keyboardMode: KeyboardModeCoordinator
  primeInteractiveAudio: () => void
  showLoading: () => void
  hideLoading: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  resetPlaybackTelemetry: () => void
  closeTransientOverlays: () => void
  modals: AppModalHandles
}

export interface RuntimeUiCallbacks {
  onSeek: (time: number) => void
  onZoom: (pps: number) => void
  onThemeCycle: () => void
  onMidiConnect: () => void
  onOpenTracks: () => void
  onRecord: () => void
  onTransposeChange: (semitones: number) => void
  onOpenFile: () => void
  onOpenLocalMidi: (id: string, target: MidiOpenTarget) => void
  onModeRequest: (mode: ModeRequest) => void
  onLearnThis: () => void
  onHome: () => void
  onInstrumentCycle: () => void
  onParticleCycle: () => void
  onLoopToggle: () => void
  onLoopClear: () => void
  onLoopSave: () => void
  onLoopUndo: () => void
  onMetronomeToggle: () => void
  onMetronomeBpmChange: (bpm: number) => void
  onSessionToggle: () => void
  onChordToggle: () => void
  onOctaveShift: (delta: number) => void
  onDropFile: (file: File, source: 'drag' | 'picker') => void
  onEnterLiveMode: () => void
  onOpenSamplePlay: (id: string) => void
  onOpenSampleLearn: (id: string) => void
  onEnterLearnMode: () => void
  onSkipHomeIntroChange: (next: boolean) => void
  onResetToTonic: () => void
  onPitchLabelsVisibleChange: (visible: boolean) => void
  onSelectInstrument: (id: string) => void
  onSelectTheme: (index: number) => void
  onSelectParticle: (index: number) => void
  onToggleChordFromMenu: () => void
  onSelectLocale: (code: string) => void
}

export interface ExportOverlayState {
  baseMidi: MidiFile | null
  transposeSemitones: number
  pitchLabelsVisible: boolean
  chordOverlayOn: boolean
  currentThemeIndex: number
  currentInstrumentIndex: number
  currentParticleIndex: number
}

export interface ExportActions {
  startExport(settings: ExportSettings): Promise<void>
  cancelExport(): void
  toggleSessionRecord(): void
  handleSessionAction(action: SessionAction): Promise<void>
  saveLoopAsMidi(): Promise<void>
  handleTransposeChange(semitones: number): void
  syncConsolePanel(): void
  toggleChordOverlay(): void
  applyChordOverlayVisibility(): void
  maybeUpdateChordOverlay(time: number): void
  setPitchLabelsVisible(visible: boolean): void
  cycleTheme(): void
  setThemeByIndex(index: number): void
  cycleInstrument(): void
  setInstrumentById(id: string): void
  cycleParticleStyle(): void
  setParticleByIndex(index: number): void
  applyTheme(theme: Theme): void
  getState(): ExportOverlayState
}
