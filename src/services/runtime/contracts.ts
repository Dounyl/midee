import type {
  ConsoleStateProvider,
  LearnRuntimeHandle,
  MidiBackedRuntime,
  PlayAlongPreparedMidiConsumer,
  TransposeAwareRuntime,
} from '@/features/learn/runtime/types'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import type { MasterClock } from '@/lib/core/MasterClock'
import type { ChordReading } from '@/lib/music/ChordDetector'
import type { InstrumentId } from '@/services/audio/instruments'
import type { Metronome } from '@/services/audio/Metronome'
import type { SynthEngine } from '@/services/audio/SynthEngine'
import type { InputBus } from '@/services/input/InputBus'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import type { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import type { Theme } from '@/services/renderer/theme'
import type { PlaybackStatus } from '@/stores/app/state'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export type MidiOpenTarget = 'play' | 'learn'
export type MidiOpenSource = 'drag' | 'picker' | 'sample'

export interface RuntimeServicesCtx {
  readonly clock: MasterClock
  readonly synth: SynthEngine
  readonly metronome: Metronome
  readonly renderer: PianoRollRenderer
  readonly input: InputBus
  readonly keyboardMode: KeyboardModeCoordinator
  primeInteractiveAudio(): void
}

export interface ExportModalPort {
  close(): void
  updateProgress(stage: string, pct: number): void
  setRenderAudioProgressMode(detailed: boolean): void
}

export interface MidiPickerOpenOptions {
  onFile: (file: File) => void
  onSamplePlay: (id: string) => void
  onSamplePractice: (id: string) => void
}

export interface RuntimeUiPort {
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
  renderTrackPanel(midi: MidiFile): void
  closeTrackPanel(): void
  hideDropzone(): void
  showDropzone(): void
  setLearnFileName(name: string | null): void
  updateConsoleState(
    enabled: boolean,
    baseKey: MidiKeySignature | null,
    current: number,
    keyboardMode: KeyboardMode,
    pitchLabelsVisible: boolean,
  ): void
  closeConsole(): void
  setTheme(theme: Theme, index: number): void
  setParticle(index: number): void
  setChord(on: boolean): void
  setChordVisible(visible: boolean): void
  updateChord(reading: ChordReading): void
  isChordVisible(): boolean
  setInstrumentLabel(name: string): void
  setCurrentInstrument(id: InstrumentId): void
}

export interface RuntimeNavigationPort {
  getCurrentTarget(): RouteTarget | null
  navigate(target: RouteTarget, options?: { replace?: boolean }): void
  enterLive(primeAudio?: boolean): void
}

export interface LearnRuntimeRegistryPort {
  register(runtime: LearnRuntimeHandle): void
  unregister(runtime: LearnRuntimeHandle): void
  getActiveRuntime(): LearnRuntimeHandle | null
  getConsoleStateProvider(): ConsoleStateProvider | null
  getMidiBackedRuntime(): MidiBackedRuntime | null
  getTransposeAwareRuntime(): TransposeAwareRuntime | null
  getPreparedMidiConsumer(): PlayAlongPreparedMidiConsumer | null
  stagePreparedPlayAlongMidi(midi: MidiFile): void
  consumePreparedPlayAlongMidi(): MidiFile | null
}

export interface DisplayPrefsState {
  baseMidi: MidiFile | null
  transposeSemitones: number
  pitchLabelsVisible: boolean
  chordOverlayOn: boolean
  currentThemeIndex: number
  currentInstrumentIndex: number
  currentParticleIndex: number
  saveThemeIndex(value: number): void
  saveInstrumentIndex(value: number): void
  saveParticleIndex(value: number): void
  saveChordOverlay(value: boolean): void
  savePitchLabels(value: boolean): void
}

export interface PlaybackSessionState {
  readonly state: {
    loadedMidi: MidiFile | null
    status: PlaybackStatus
    currentTime: number
    duration: number
    volume: number
    speed: number
  }
  setState(key: 'status', value: PlaybackStatus): void
  readonly hasLoadedFile: boolean
  enterPlayLanding(): void
  beginPlayLoad(): void
  completePlayLoad(midi: MidiFile): void
  replaceLoadedMidi(midi: MidiFile): void
  enterPlay(resetTime?: boolean): boolean
  enterLive(resetTime?: boolean): void
  setStatus(value: PlaybackStatus): void
}
