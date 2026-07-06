import { trackMidiLoaded } from '@/features/telemetry'
import { transposeMidiFile } from '@/lib/music/KeySignature'
import type { MidiFile } from '@/types/midi/types'
import type { KeyboardModeCoordinator } from './KeyboardModeCoordinator'

interface MidiModeResolutionOptions {
  keyboardMode: KeyboardModeCoordinator
  completePlayLoad: (midi: MidiFile) => void
  resetPlaybackTelemetry: () => void
  resumePlaybackSoon: (delayMs: number) => void
}

type MidiLoadedTelemetry =
  | { source: 'drag' | 'picker'; fileSizeKb: number }
  | { source: 'picker'; target: 'play' }
  | { source: 'sample'; sampleId: string }

export class MidiModeResolution {
  constructor(private readonly opts: MidiModeResolutionOptions) {}

  resolveFilePlayLoad(
    midi: MidiFile,
    sourceMidi: MidiFile,
    telemetry: Extract<MidiLoadedTelemetry, { fileSizeKb: number }>,
  ): boolean {
    return this.ensurePlayable(midi, sourceMidi, telemetry)
  }

  resolveSessionPlayLoad(
    midi: MidiFile,
    sourceMidi: MidiFile,
    telemetry: Exclude<MidiLoadedTelemetry, { fileSizeKb: number }>,
    resumeDelayMs: number,
  ): boolean {
    return this.ensurePlayable(midi, sourceMidi, telemetry, resumeDelayMs)
  }

  private ensurePlayable(
    midi: MidiFile,
    sourceMidi: MidiFile,
    telemetry: MidiLoadedTelemetry,
    resumeDelayMs?: number,
  ): boolean {
    const accepted = this.opts.keyboardMode.ensureMidiFitsCurrentMode(midi, sourceMidi, {
      onTranspose: (semitones) => {
        const resolvedMidi = transposeMidiFile(sourceMidi, semitones)
        this.completeAndTrack(resolvedMidi, telemetry, resumeDelayMs)
      },
      onSwitchTo88: () => {
        this.completeAndTrack(sourceMidi, telemetry, resumeDelayMs)
      },
    })
    if (accepted) this.completeAndTrack(midi, telemetry, resumeDelayMs)
    return accepted
  }

  private completeAndTrack(
    midi: MidiFile,
    telemetry: MidiLoadedTelemetry,
    resumeDelayMs?: number,
  ): void {
    this.opts.completePlayLoad(midi)
    this.opts.resetPlaybackTelemetry()
    trackMidiLoaded({
      ...telemetry,
      trackCount: midi.tracks.length,
      noteCount: countNotes(midi),
      durationS: Math.round(midi.duration),
    })
    if (resumeDelayMs !== undefined) this.opts.resumePlaybackSoon(resumeDelayMs)
  }
}

function countNotes(midi: Pick<MidiFile, 'tracks'>): number {
  return midi.tracks.reduce((sum, track) => sum + track.notes.length, 0)
}
