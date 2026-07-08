import type { ChordOverlay } from '@/components/playback/ChordOverlay'
import type { ConsolePanel } from '@/components/playback/ConsolePanel'
import type { createControls } from '@/components/playback/Controls'
import type { CustomizeMenu } from '@/components/playback/CustomizeMenu'
import type { DropZone } from '@/components/playback/DropZone'
import type { InstrumentMenu } from '@/components/playback/InstrumentMenu'
import type { TrackPanel } from '@/components/playback/TrackPanel'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import type { ChordReading } from '@/lib/music/ChordDetector'
import type { InstrumentId } from '@/services/audio/instruments'
import type { MidiDeviceStatus } from '@/services/midi/MidiInputManager'
import type { Theme } from '@/services/renderer/theme'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export interface RuntimeUiBridgeParts {
  controls: ReturnType<typeof createControls>
  dropzone: DropZone
  trackPanel: TrackPanel
  consolePanel: ConsolePanel
  instrumentMenu: InstrumentMenu
  chordOverlay: ChordOverlay
  customizeMenu: CustomizeMenu
}

export class RuntimeUiBridge {
  readonly controls: ReturnType<typeof createControls>
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

  toggleTrackPanel(): void {
    this.trackPanel.toggle()
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

  closeTrackPanel(): void {
    this.trackPanel.close()
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
    if (this.controls.tracksButton) {
      this.trackPanel.setTrigger(this.controls.tracksButton)
    }
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
