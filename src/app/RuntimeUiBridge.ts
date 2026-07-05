import type { InstrumentId } from '../audio/instruments'
import type { KeyboardMode } from '../core/keyboardLayout'
import type { MidiFile, MidiKeySignature } from '../core/midi/types'
import type { ChordReading } from '../core/music/ChordDetector'
import type { MidiDeviceStatus } from '../midi/MidiInputManager'
import type { Theme } from '../renderer/theme'
import type { ChordOverlay } from '../ui/ChordOverlay'
import type { ConsolePanel } from '../ui/ConsolePanel'
import type { Controls } from '../ui/Controls'
import type { CustomizeMenu } from '../ui/CustomizeMenu'
import type { DropZone } from '../ui/DropZone'
import type { InstrumentMenu } from '../ui/InstrumentMenu'
import type { TrackPanel } from '../ui/TrackPanel'

export interface RuntimeUiBridgeParts {
  controls: Controls
  dropzone: DropZone
  trackPanel: TrackPanel
  consolePanel: ConsolePanel
  instrumentMenu: InstrumentMenu
  chordOverlay: ChordOverlay
  customizeMenu: CustomizeMenu
}

export class RuntimeUiBridge {
  readonly controls: Controls
  readonly dropzone: DropZone
  readonly trackPanel: TrackPanel
  readonly consolePanel: ConsolePanel
  readonly instrumentMenu: InstrumentMenu
  readonly chordOverlay: ChordOverlay
  readonly customizeMenu: CustomizeMenu

  constructor(parts: RuntimeUiBridgeParts) {
    this.controls = parts.controls
    this.dropzone = parts.dropzone
    this.trackPanel = parts.trackPanel
    this.consolePanel = parts.consolePanel
    this.instrumentMenu = parts.instrumentMenu
    this.chordOverlay = parts.chordOverlay
    this.customizeMenu = parts.customizeMenu
  }

  syncLoopState(state: string, layerCount: number): void {
    this.controls.updateLoopState(state as never, layerCount)
  }

  syncLoopProgress(progress: number): void {
    this.controls.updateLoopProgress(progress)
  }

  syncMetronome(running: boolean, bpm: number): void {
    this.controls.updateMetronome(running, bpm)
  }

  pulseMetronomeBeat(isDownbeat: boolean): void {
    this.controls.pulseMetronomeBeat(isDownbeat)
  }

  syncSessionRecording(recording: boolean, elapsed: number): void {
    this.controls.updateSessionRecording(recording, elapsed)
  }

  syncMidiStatus(status: MidiDeviceStatus, deviceName: string): void {
    this.controls.updateMidiStatus(status, deviceName)
    this.dropzone.updateMidiStatus(status, deviceName)
  }

  syncOctave(octave: number): void {
    this.controls.updateOctave(octave)
  }

  setInstrumentLoading(loading: boolean): void {
    this.controls.setInstrumentLoading(loading)
  }

  setInstrumentMenuLoading(id: InstrumentId | null): void {
    this.instrumentMenu.setLoading(id)
    this.controls.setInstrumentLoading(id !== null)
  }

  setInstrumentLabel(name: string): void {
    this.controls.updateInstrument(name)
  }

  setCurrentInstrument(id: InstrumentId): void {
    this.instrumentMenu.setCurrent(id)
  }

  renderTrackPanel(midi: MidiFile): void {
    this.trackPanel.render(midi)
  }

  hideDropzone(): void {
    this.dropzone.hide()
  }

  showDropzone(): void {
    this.dropzone.show()
  }

  setLearnFileName(name: string | null): void {
    this.controls.updateLearnFileName(name)
  }

  updateConsoleState(
    enabled: boolean,
    baseKey: MidiKeySignature | null,
    current: number,
    keyboardMode: KeyboardMode,
    pitchLabelsVisible: boolean,
  ): void {
    this.consolePanel.updateState(enabled, baseKey, current, keyboardMode, pitchLabelsVisible)
  }

  closeConsole(): void {
    this.consolePanel.close()
  }

  setTheme(theme: Theme, index: number): void {
    this.customizeMenu.setTheme(index)
    this.trackPanel.setTheme(theme)
  }

  setParticle(index: number): void {
    this.customizeMenu.setParticle(index)
  }

  setChord(on: boolean): void {
    this.customizeMenu.setChord(on)
    this.controls.updateChordOverlayState(on)
  }

  setChordVisible(visible: boolean): void {
    this.chordOverlay.setVisible(visible)
  }

  updateChord(reading: ChordReading): void {
    this.chordOverlay.update(reading)
  }

  get chordVisible(): boolean {
    return this.chordOverlay.isVisible
  }

  bindTrackTrigger(): void {
    this.trackPanel.setTrigger(this.controls.tracksButton)
  }

  dispose(): void {
    this.dropzone.dispose()
    this.controls.dispose()
    this.chordOverlay.dispose()
    this.customizeMenu.dispose()
    this.consolePanel.dispose()
    this.trackPanel.dispose()
    this.instrumentMenu.dispose()
  }
}
