import type { ExportSettings } from '@/components/export/ExportModal'
import type { SessionAction } from '@/components/export/PostSessionModal'
import { ExportFlowService } from '@/services/export/ExportFlowService'
import { RuntimeOverlayController } from '@/services/export/RuntimeOverlayController'
import type { LiveLooper } from '@/services/midi/LiveLooper'
import type { LiveNoteStore } from '@/services/midi/LiveNoteStore'
import type { CapturedEvent } from '@/services/midi/MidiEncoding'
import type { SessionRecorder } from '@/services/midi/SessionRecorder'
import type { Theme } from '@/services/renderer/theme'
import type { MidiFile } from '@/types/midi/types'
import type {
  DisplayPrefsState,
  LearnRuntimeRegistryPort,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from './contracts'

interface ExportAndOverlayCoordinatorOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  learnRuntimeRegistry: LearnRuntimeRegistryPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
  liveNotes: LiveNoteStore
  loopNotes: LiveNoteStore
  liveLooper: LiveLooper
  sessionRec: SessionRecorder
  exporterRef: { current: { cancel(): void } | null }
  pendingSessionRef: { current: { events: CapturedEvent[]; duration: number } | null }
  loadSessionMidi: (midi: MidiFile) => void
}

export class ExportAndOverlayCoordinator {
  private readonly exportFlow: ExportFlowService
  private readonly runtimeOverlay: RuntimeOverlayController

  constructor(opts: ExportAndOverlayCoordinatorOptions) {
    this.exportFlow = new ExportFlowService({
      services: opts.services,
      ui: opts.ui,
      navigation: opts.navigation,
      displayPrefs: opts.displayPrefs,
      playbackSession: opts.playbackSession,
      liveNotes: opts.liveNotes,
      exporterRef: opts.exporterRef,
    })
    this.runtimeOverlay = new RuntimeOverlayController(opts)
  }

  openExportModal(): void {
    this.exportFlow.openModal()
  }

  async startExport(settings: ExportSettings): Promise<void> {
    await this.exportFlow.startExport(settings)
  }

  cancelExport(): void {
    this.exportFlow.cancelExport()
  }

  toggleSessionRecord(): void {
    this.runtimeOverlay.toggleSessionRecord()
  }

  async handleSessionAction(action: SessionAction): Promise<void> {
    await this.runtimeOverlay.handleSessionAction(action)
  }

  async saveLoopAsMidi(): Promise<void> {
    await this.runtimeOverlay.saveLoopAsMidi()
  }

  handleTransposeChange(semitones: number): void {
    this.runtimeOverlay.handleTransposeChange(semitones)
  }

  syncConsolePanel(): void {
    this.runtimeOverlay.syncConsolePanel()
  }

  setPitchLabelsVisible(visible: boolean): void {
    this.runtimeOverlay.setPitchLabelsVisible(visible)
  }

  toggleChordOverlay(): void {
    this.runtimeOverlay.toggleChordOverlay()
  }

  applyChordOverlayVisibility(): void {
    this.runtimeOverlay.applyChordOverlayVisibility()
  }

  maybeUpdateChordOverlay(time: number): void {
    this.runtimeOverlay.maybeUpdateChordOverlay(time)
  }

  cycleTheme(): void {
    this.runtimeOverlay.cycleTheme()
  }

  setThemeByIndex(index: number): void {
    this.runtimeOverlay.setThemeByIndex(index)
  }

  cycleInstrument(): void {
    this.runtimeOverlay.cycleInstrument()
  }

  setInstrumentById(id: string): void {
    this.runtimeOverlay.setInstrumentById(id)
  }

  cycleParticleStyle(): void {
    this.runtimeOverlay.cycleParticleStyle()
  }

  setParticleByIndex(index: number): void {
    this.runtimeOverlay.setParticleByIndex(index)
  }

  applyTheme(theme: Theme): void {
    this.runtimeOverlay.applyTheme(theme)
  }

  applyInstrument(): void {
    this.runtimeOverlay.applyInstrument()
  }

  applyParticleStyle(): void {
    this.runtimeOverlay.applyParticleStyle()
  }

  getState(): DisplayPrefsState {
    return this.runtimeOverlay.getState()
  }
}
