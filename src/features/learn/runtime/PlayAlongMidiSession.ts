import type { LearnState, LearnStatus } from '@/features/learn/core/LearnState'
import { transposeMidiFile } from '@/lib/music/KeySignature'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'

export interface PlayAlongMidiSessionDeps {
  services: AppServices
  learnState: LearnState
  keyboardMode: KeyboardModeCoordinator
  setLearnFileName: (name: string | null) => void
  updateConsolePanel: () => void
  onMidiReady: (midi: MidiFile) => Promise<void> | void
}

export class PlayAlongMidiSession {
  private baseMidi: MidiFile | null = null
  private transposeSemitones = 0

  constructor(private readonly deps: PlayAlongMidiSessionDeps) {}

  get baseKey() {
    return this.baseMidi?.keySignature ?? null
  }

  get currentTranspose(): number {
    return this.transposeSemitones
  }

  clearSession(): void {
    const { services } = this.deps
    services.clock.pause()
    services.clock.seek(0)
    services.synth.pause()
    this.deps.learnState.clearMidi()
    this.baseMidi = null
    this.transposeSemitones = 0
    this.deps.setLearnFileName(null)
    this.deps.updateConsolePanel()
  }

  async loadPreparedMidi(midi: MidiFile): Promise<void> {
    this.deps.learnState.beginLoad()
    await this.consumeMidi(midi)
  }

  isTransposeEnabled(): boolean {
    const status = this.deps.learnState.state.status
    return (
      this.deps.learnState.state.loadedMidi !== null && status !== 'playing' && status !== 'loading'
    )
  }

  setTranspose(
    semitones: number,
    status: LearnStatus,
    onMidiReplaced: (midi: MidiFile) => void,
  ): void {
    if (!this.baseMidi) return
    const next = Math.trunc(semitones)
    if (next === this.transposeSemitones) return
    const midi = transposeMidiFile(this.baseMidi, next)
    if (
      !this.deps.keyboardMode.ensureMidiFitsCurrentMode(midi, this.baseMidi, {
        onTranspose: (target) => this.setTranspose(target, status, onMidiReplaced),
      })
    )
      return
    this.transposeSemitones = next
    const { services } = this.deps
    const currentTime = services.clock.currentTime
    services.clock.pause()
    services.synth.pause()
    services.synth.load(midi).catch((err) => {
      console.error('[PlayAlongMidiSession] SynthEngine.load failed:', err)
    })
    this.deps.learnState.setState({
      loadedMidi: midi,
      duration: midi.duration,
      currentTime,
      status,
    })
    services.clock.seek(currentTime)
    services.synth.seek(currentTime)
    services.renderer.loadMidi(midi)
    onMidiReplaced(midi)
    this.deps.updateConsolePanel()
  }

  private async consumeMidi(midi: MidiFile): Promise<void> {
    const { services } = this.deps
    services.clock.pause()
    services.clock.seek(0)
    services.synth.pause()
    services.renderer.clearMidi()
    this.deps.learnState.clearMidi()
    if (
      !this.deps.keyboardMode.ensureMidiFitsCurrentMode(midi, midi, {
        onTranspose: async (target) => {
          await this.consumeMidi(transposeMidiFile(midi, target))
        },
        onSwitchTo88: async () => {
          await this.consumeMidi(midi)
        },
      })
    )
      return
    this.baseMidi = midi
    this.transposeSemitones = 0
    services.synth.load(midi).catch((err) => {
      console.error('[PlayAlongMidiSession] SynthEngine.load failed:', err)
    })
    this.deps.learnState.completeLoad(midi)
    services.renderer.setKeyboardMode(this.deps.keyboardMode.getMode())
    this.deps.setLearnFileName(midi.name)
    this.deps.updateConsolePanel()
    await this.deps.onMidiReady(midi)
  }
}
