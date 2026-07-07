import { resolveConsoleResetTranspose } from '@/app/runtime/bootstrapConsole'
import type {
  BootstrapRuntimeUiControlsOptions,
  BootstrapRuntimeUiMenuOptions,
  BootstrapRuntimeUiOverlayOptions,
  BootstrapRuntimeUiPlaybackOptions,
} from '@/app/runtime/bootstrapUi'
import type { LoadSource } from '@/components/playback/DropZone'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import type { InstrumentId } from '@/services/audio/instruments'
import { track, trackEvent, trackEventSettled } from '@/services/telemetry'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export interface CreateBootstrapRuntimeUiControlsOptions {
  seek(time: number): void
  zoom(pixelsPerSecond: number): void
  cycleTheme(): void
  connectMidi(): Promise<void> | void
  openTracks(): void
  openExport(): void
  hasLoadedMidi(): boolean
  setTranspose(semitones: number): void
  cycleInstrument(): void
  cycleParticleStyle(): void
  toggleLoop(): void
  getLoopLayerCount(): number
  clearLoop(): void
  saveLoopAsMidi(): Promise<void> | void
  undoLoop(): void
  toggleMetronome(): void
  isMetronomeRunning(): boolean
  setMetronomeBpm(bpm: number): void
  getMetronomeBpm(): number
  persistMetronomeBpm(bpm: number): void
  toggleSessionRecord(): void
  toggleChordOverlay(): void
  shiftOctave(delta: number): void
}

export function createBootstrapRuntimeUiControls(
  options: CreateBootstrapRuntimeUiControlsOptions,
): BootstrapRuntimeUiControlsOptions {
  return {
    onSeek: (time) => {
      options.seek(time)
    },
    onZoom: (pixelsPerSecond) => {
      options.zoom(pixelsPerSecond)
    },
    onThemeCycle: () => {
      options.cycleTheme()
    },
    onMidiConnect: () => void options.connectMidi(),
    onOpenTracks: () => {
      options.openTracks()
    },
    onRecord: () => {
      track('export_opened', { has_midi: options.hasLoadedMidi() })
      options.openExport()
    },
    onTransposeChange: (semitones) => {
      options.setTranspose(semitones)
    },
    onInstrumentCycle: () => {
      options.cycleInstrument()
    },
    onParticleCycle: () => {
      options.cycleParticleStyle()
    },
    onLoopToggle: () => {
      options.toggleLoop()
    },
    onLoopClear: () => {
      const layers = options.getLoopLayerCount()
      options.clearLoop()
      if (layers > 0) track('loop_cleared', { layers })
    },
    onLoopSave: () => void options.saveLoopAsMidi(),
    onLoopUndo: () => {
      const before = options.getLoopLayerCount()
      options.undoLoop()
      if (before > 0) track('loop_undone', { layers_before: before })
    },
    onMetronomeToggle: () => {
      options.toggleMetronome()
      trackEvent('metronome_toggled', { on: options.isMetronomeRunning() })
    },
    onMetronomeBpmChange: (bpm) => {
      options.setMetronomeBpm(bpm)
      const nextBpm = options.getMetronomeBpm()
      options.persistMetronomeBpm(nextBpm)
      trackEventSettled('tempo_changed', { bpm: nextBpm })
    },
    onSessionToggle: () => {
      options.toggleSessionRecord()
    },
    onChordToggle: () => {
      options.toggleChordOverlay()
    },
    onOctaveShift: (delta) => {
      options.shiftOctave(delta)
    },
  }
}

export interface CreateBootstrapRuntimeUiPlaybackOptions {
  renderer: BootstrapRuntimeUiPlaybackOptions['panels']['renderer']
  openDroppedMidi(file: File, source: LoadSource): Promise<void> | void
  setTrackEnabled(trackId: string, enabled: boolean): void
  openFilePicker(): void
  selectInstrument(id: InstrumentId): void
}

export function createBootstrapRuntimeUiPlayback(
  options: CreateBootstrapRuntimeUiPlaybackOptions,
): BootstrapRuntimeUiPlaybackOptions {
  return {
    onDrop: (file, source) => {
      void options.openDroppedMidi(file, source)
    },
    panels: {
      renderer: options.renderer,
      onTrackEnabledChange: (trackId, enabled) => {
        options.setTrackEnabled(trackId, enabled)
        trackEvent('track_toggled', { enabled })
      },
      onLoadNew: () => {
        options.openFilePicker()
      },
      onSelectInstrument: (id) => {
        options.selectInstrument(id)
      },
    },
  }
}

export interface CreateBootstrapRuntimeUiMenusOptions {
  chordOverlayOn: boolean
  setThemeByIndex(index: number): void
  setParticleByIndex(index: number): void
  toggleChordOverlay(): void
}

export function createBootstrapRuntimeUiMenus(
  options: CreateBootstrapRuntimeUiMenusOptions,
): BootstrapRuntimeUiMenuOptions {
  return {
    chordOverlayOn: options.chordOverlayOn,
    customize: {
      onSelectTheme: (index) => {
        options.setThemeByIndex(index)
      },
      onSelectParticle: (index) => {
        options.setParticleByIndex(index)
      },
      onToggleChord: () => {
        options.toggleChordOverlay()
      },
    },
  }
}

export interface CreateBootstrapRuntimeUiConsoleOptions {
  handleTransposeChange(semitones: number): void
  getLearnBaseKey(): MidiKeySignature | null
  getPlayBaseKey(): MidiKeySignature | null
  includeLearnBaseKey(): boolean
  requestKeyboardModeChange(
    mode: KeyboardMode,
    options: {
      activeMidi: MidiFile | null
      onTranspose(semitones: number): void
    },
  ): void
  getActiveMidi(): MidiFile | null
  setPitchLabelsVisible(visible: boolean): void
}

export function createBootstrapRuntimeUiConsole(
  options: CreateBootstrapRuntimeUiConsoleOptions,
): BootstrapRuntimeUiOverlayOptions {
  return {
    console: {
      onChange: (value) => {
        options.handleTransposeChange(value)
      },
      onResetToC: () => {
        options.handleTransposeChange(
          resolveConsoleResetTranspose({
            learnBaseKey: options.includeLearnBaseKey() ? options.getLearnBaseKey() : null,
            playBaseKey: options.getPlayBaseKey(),
          }),
        )
      },
      onKeyboardModeChange: (mode) => {
        options.requestKeyboardModeChange(mode, {
          activeMidi: options.getActiveMidi(),
          onTranspose: (semitones) => options.handleTransposeChange(semitones),
        })
      },
      onToggleLabels: (visible) => {
        options.setPitchLabelsVisible(visible)
      },
    },
  }
}
