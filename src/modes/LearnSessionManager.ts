import { parseMidiFile } from '../core/midi/parser'
import type { MidiFile } from '../core/midi/types'
import { saveLocalMidi } from '../core/midiLibrary'
import { transposeMidiFile } from '../core/music/KeySignature'
import { fetchSampleMidi, getSample } from '../core/samples'
import { t } from '../i18n'
import type { LearnState, LearnStatus } from '../learn/core/LearnState'
import {
  midiLoadErrorType,
  trackEvent,
  trackMidiLoaded,
  trackMidiLoadFailed,
} from '../telemetry'
import type { ModeContext } from './ModeController'

export interface LearnSessionManagerDeps {
  ctx: ModeContext
  learnState: LearnState
  onMidiReady: (midi: MidiFile) => Promise<void> | void
  onError: (msg: string) => void
}

export class LearnSessionManager {
  private baseMidi: MidiFile | null = null
  private transposeSemitones = 0

  constructor(private deps: LearnSessionManagerDeps) {}

  get baseKey() {
    return this.baseMidi?.keySignature ?? null
  }

  get currentTranspose(): number {
    return this.transposeSemitones
  }

  clearSession(): void {
    const { services } = this.deps.ctx
    services.clock.pause()
    services.clock.seek(0)
    services.synth.pause()
    this.deps.learnState.clearMidi()
    this.baseMidi = null
    this.transposeSemitones = 0
    this.deps.ctx.setLearnFileName(null)
    this.deps.ctx.updateConsolePanel()
  }

  async loadPreparedMidi(midi: MidiFile): Promise<void> {
    this.deps.learnState.beginLoad()
    await this.consumeMidi(midi)
  }

  async loadMidiFromFile(file: File, source: 'drag' | 'picker' = 'picker'): Promise<void> {
    this.deps.learnState.beginLoad()
    try {
      const midi = await parseMidiFile(file)
      await saveLocalMidi(file, midi).catch((err) => {
        console.warn('[LearnSessionManager] saveLocalMidi failed', err)
      })
      await this.consumeMidi(midi)
      trackMidiLoaded({
        source,
        target: 'learn',
        trackCount: midi.tracks.length,
        noteCount: midi.tracks.reduce((n, tk) => n + tk.notes.length, 0),
        durationS: Math.round(midi.duration),
        fileSizeKb: Math.round(file.size / 1024),
      })
    } catch (err) {
      console.error('[LearnSessionManager] loadMidiFromFile failed:', err)
      trackMidiLoadFailed({
        source,
        target: 'learn',
        errorType: await midiLoadErrorType(err, file),
        fileExt: file.name.split('.').pop()?.toLowerCase() ?? null,
        fileSizeKb: Math.round(file.size / 1024),
      })
      this.deps.learnState.setState('status', 'ready')
      this.deps.onError(
        err instanceof Error && err.name === 'EmptyMidiError'
          ? t('error.midi.empty')
          : t('error.midi.parseFailed'),
      )
    }
  }

  async loadSample(sampleId: string): Promise<void> {
    const sample = getSample(sampleId)
    if (!sample) return
    this.deps.ctx.primeInteractiveAudio()
    this.deps.learnState.beginLoad()
    try {
      const midi = await fetchSampleMidi(sample)
      await this.consumeMidi(midi)
      trackMidiLoaded({
        source: 'sample',
        target: 'learn',
        sampleId,
        trackCount: midi.tracks.length,
        noteCount: midi.tracks.reduce((n, tk) => n + tk.notes.length, 0),
        durationS: Math.round(midi.duration),
      })
    } catch (err) {
      console.error('[LearnSessionManager] loadSample failed:', err)
      trackEvent('sample_load_failed', { sample_id: sampleId, target: 'learn' })
      this.deps.learnState.setState('status', 'ready')
      this.deps.onError(t('error.sample.fetchFailed'))
    }
  }

  isTransposeEnabled(): boolean {
    const status = this.deps.learnState.state.status
    return this.deps.learnState.state.loadedMidi !== null && status !== 'playing' && status !== 'loading'
  }

  setTranspose(semitones: number, status: LearnStatus, onMidiReplaced: (midi: MidiFile) => void): void {
    if (!this.baseMidi) return
    const next = Math.trunc(semitones)
    if (next === this.transposeSemitones) return
    const midi = transposeMidiFile(this.baseMidi, next)
    if (
      !this.deps.ctx.keyboardMode.ensureMidiFitsCurrentMode(midi, this.baseMidi, {
        onTranspose: (target) => this.setTranspose(target, status, onMidiReplaced),
      })
    )
      return
    this.transposeSemitones = next
    const { services } = this.deps.ctx
    const currentTime = services.clock.currentTime
    services.clock.pause()
    services.synth.pause()
    services.synth.load(midi).catch((err) => {
      console.error('[LearnSessionManager] SynthEngine.load failed:', err)
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
    this.deps.ctx.updateConsolePanel()
  }

  private async consumeMidi(midi: MidiFile): Promise<void> {
    const { services } = this.deps.ctx
    services.clock.pause()
    services.clock.seek(0)
    services.synth.pause()
    services.renderer.clearMidi()
    this.deps.learnState.clearMidi()
    if (
      !this.deps.ctx.keyboardMode.ensureMidiFitsCurrentMode(midi, midi, {
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
      console.error('[LearnSessionManager] SynthEngine.load failed:', err)
    })
    this.deps.learnState.completeLoad(midi)
    services.renderer.setKeyboardMode(this.deps.ctx.keyboardMode.getMode())
    this.deps.ctx.setLearnFileName(midi.name)
    this.deps.ctx.updateConsolePanel()
    await this.deps.onMidiReady(midi)
  }
}
