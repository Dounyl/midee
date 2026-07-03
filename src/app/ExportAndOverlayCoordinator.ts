import type { MidiFile, MidiKeySignature } from '../core/midi/types'
import type { LiveLooper } from '../midi/LiveLooper'
import type { LiveNoteStore } from '../midi/LiveNoteStore'
import type { CapturedEvent } from '../midi/MidiEncoding'
import type { SessionRecorder } from '../midi/SessionRecorder'
import type { Theme } from '../renderer/theme'
import type { AppStore } from '../store/state'
import type { ExportSettings } from '../ui/ExportModal'
import type { SessionAction } from '../ui/PostSessionModal'
import { ExportFlowService } from './export/ExportFlowService'
import { RuntimeOverlayController } from './export/RuntimeOverlayController'
import type { KeyboardModeCoordinator } from './KeyboardModeCoordinator'
import type { RuntimeUiBridge } from './RuntimeUiBridge'
import type { AppRuntimeDeps, ExportOverlayState } from './types'

interface ExportAndOverlayCoordinatorOptions extends AppRuntimeDeps {
  store: AppStore
  ui: RuntimeUiBridge
  state: ExportOverlayState
  liveNotes: LiveNoteStore
  loopNotes: LiveNoteStore
  liveLooper: LiveLooper
  sessionRec: SessionRecorder
  exporterRef: { current: { cancel(): void } | null }
  pendingSessionRef: { current: { events: CapturedEvent[]; duration: number } | null }
  loadSessionMidi: (midi: MidiFile) => void
  metronomeBpm: () => number
  isTransposeEnabled: () => boolean
  getLearnConsoleState: () => {
    enabled: boolean
    baseKey: MidiKeySignature | null
    current: number
  } | null
  keyboardMode: KeyboardModeCoordinator
}

export class ExportAndOverlayCoordinator {
  private readonly exportFlow: ExportFlowService
  private readonly runtimeOverlay: RuntimeOverlayController

  constructor(opts: ExportAndOverlayCoordinatorOptions) {
    this.exportFlow = new ExportFlowService({
      services: opts.services,
      store: opts.store,
      renderer: opts.renderer,
      persistence: opts.persistence,
      ensureLearnController: opts.ensureLearnController,
      keyboardMode: opts.keyboardMode,
      primeInteractiveAudio: opts.primeInteractiveAudio,
      showLoading: opts.showLoading,
      hideLoading: opts.hideLoading,
      showError: opts.showError,
      showSuccess: opts.showSuccess,
      resetPlaybackTelemetry: opts.resetPlaybackTelemetry,
      closeTransientOverlays: opts.closeTransientOverlays,
      modals: opts.modals,
      state: opts.state,
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

  getState(): ExportOverlayState {
    return this.runtimeOverlay.getState()
  }
}
