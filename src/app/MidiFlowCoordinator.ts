import { parseMidiFile } from '../core/midi/parser'
import type { MidiFile } from '../core/midi/types'
import { loadLocalMidi, recordSamplePlayback, saveLocalMidi } from '../core/midiLibrary'
import { transposeMidiFile } from '../core/music/KeySignature'
import { fetchSampleMidi, getSample } from '../core/samples'
import { t } from '../i18n'
import { setNextLiveOpts } from '../modes/LiveMode'
import type { LearnEnterRequest } from '../store/AppCtx'
import {
  midiLoadErrorType,
  track,
  trackEvent,
  trackMidiLoaded,
  trackMidiLoadFailed,
} from '../telemetry'
import { applyModeRequest } from './applyModeRequest'
import type { RuntimeUiBridge } from './RuntimeUiBridge'
import type {
  AppRuntimeDeps,
  ExportOverlayState,
  MidiOpenSource,
  MidiOpenTarget,
  ModeRequest,
} from './types'
import { countNotes } from './utils'

interface MidiFlowCoordinatorOptions extends AppRuntimeDeps {
  keyboardInput: { enable(): void }
  ui: RuntimeUiBridge
  state: ExportOverlayState
  onSyncConsolePanel: () => void
  onResetInteractionState: () => void
}

export class MidiFlowCoordinator {
  constructor(private readonly opts: MidiFlowCoordinatorOptions) {}

  async openFile(
    file: File,
    source: Extract<MidiOpenSource, 'drag' | 'picker'>,
    target: MidiOpenTarget,
  ): Promise<void> {
    if (target === 'learn') {
      const controller = await this.opts.ensureLearnController()
      await controller.loadMidiFromFile(file, source)
      return
    }
    await this.loadMidi(file, source)
  }

  async openSample(sampleId: string, target: MidiOpenTarget): Promise<void> {
    if (target === 'learn') {
      const sample = getSample(sampleId)
      if (!sample) return
      this.opts.primeInteractiveAudio()
      try {
        const midi = await fetchSampleMidi(sample)
        recordSamplePlayback(sampleId)
        await this.handoffMidiToLearn(midi)
        trackMidiLoaded({
          source: 'sample',
          target: 'learn',
          sampleId,
          trackCount: midi.tracks.length,
          noteCount: countNotes(midi),
          durationS: Math.round(midi.duration),
        })
      } catch (err) {
        console.error('[openSample] learn fetch failed', err)
        trackEvent('sample_load_failed', { sample_id: sampleId, target: 'learn' })
        this.opts.showError(t('error.sample.fetchFailed'))
      }
      return
    }

    const sample = getSample(sampleId)
    if (!sample) return
    this.opts.primeInteractiveAudio()
    let midi: Awaited<ReturnType<typeof fetchSampleMidi>>
    try {
      midi = await fetchSampleMidi(sample)
    } catch (err) {
      console.error('[loadSample] fetch failed', err)
      trackEvent('sample_load_failed', { sample_id: sampleId, target: 'play' })
      this.opts.showError(t('error.sample.fetchFailed'))
      return
    }
    recordSamplePlayback(sampleId)
    if (!this.resolveKeyboardModeForPlayLoad(midi, midi, { source: 'sample', sampleId }, 250))
      return
    this.loadSessionMidi(midi)
    this.opts.resetPlaybackTelemetry()
    trackMidiLoaded({
      source: 'sample',
      sampleId,
      trackCount: midi.tracks.length,
      noteCount: countNotes(midi),
      durationS: Math.round(midi.duration),
    })
    this.resumePlaybackSoon(250)
  }

  async openLocal(id: string, target: MidiOpenTarget): Promise<void> {
    try {
      this.opts.primeInteractiveAudio()
      const midi = await loadLocalMidi(id)
      if (target === 'learn') {
        await this.handoffMidiToLearn(midi)
        trackMidiLoaded({
          source: 'picker',
          target: 'learn',
          trackCount: midi.tracks.length,
          noteCount: countNotes(midi),
          durationS: Math.round(midi.duration),
        })
        return
      }

      if (
        !this.resolveKeyboardModeForPlayLoad(midi, midi, { source: 'picker', target: 'play' }, 120)
      )
        return
      this.loadSessionMidi(midi)
      this.opts.resetPlaybackTelemetry()
      trackMidiLoaded({
        source: 'picker',
        target: 'play',
        trackCount: midi.tracks.length,
        noteCount: countNotes(midi),
        durationS: Math.round(midi.duration),
      })
      this.resumePlaybackSoon(120)
    } catch (err) {
      console.error('[openLocalMidi] failed', err)
      this.opts.showError(t('error.midi.parseFailed'))
    }
  }

  requestMode(mode: ModeRequest): void {
    applyModeRequest(this.opts.store, mode, {
      ensureLearnController: this.opts.ensureLearnController,
      enterLiveMode: () => this.enterLiveMode(),
      enterPlayMode: () => this.enterPlayMode(),
    })
  }

  async enterLearn(request: LearnEnterRequest): Promise<void> {
    if (request.kind === 'empty') {
      this.requestMode('learn')
      return
    }

    if (request.kind === 'current-midi') {
      const midi = this.opts.store.state.loadedMidi
      if (!midi) return
      track('learn_from_play', { duration_s: Math.round(midi.duration) })
      await this.handoffMidiToLearn(midi)
      return
    }

    if (request.kind === 'sample') {
      const sample = getSample(request.sampleId)
      if (!sample) return
      this.opts.primeInteractiveAudio()
      try {
        const midi = await fetchSampleMidi(sample)
        recordSamplePlayback(request.sampleId)
        await this.handoffMidiToLearn(midi)
        trackMidiLoaded({
          source: 'sample',
          target: 'learn',
          sampleId: request.sampleId,
          trackCount: midi.tracks.length,
          noteCount: countNotes(midi),
          durationS: Math.round(midi.duration),
        })
      } catch (err) {
        console.error('[enterLearn] sample fetch failed', err)
        trackEvent('sample_load_failed', { sample_id: request.sampleId, target: 'learn' })
        this.opts.showError(t('error.sample.fetchFailed'))
      }
      return
    }

    try {
      this.opts.primeInteractiveAudio()
      const midi = await loadLocalMidi(request.id)
      await this.handoffMidiToLearn(midi)
      trackMidiLoaded({
        source: 'picker',
        target: 'learn',
        trackCount: midi.tracks.length,
        noteCount: countNotes(midi),
        durationS: Math.round(midi.duration),
      })
    } catch (err) {
      console.error('[enterLearn] local midi failed', err)
      this.opts.showError(t('error.midi.parseFailed'))
    }
  }

  enterHomeMode(): void {
    this.opts.store.enterHome()
  }

  enterLiveMode(primeAudio = true): void {
    setNextLiveOpts({ primeAudio })
    this.opts.store.enterLive()
  }

  enterPlayMode(): void {
    this.opts.store.enterPlay()
  }

  loadSessionMidi(midi: MidiFile): void {
    this.opts.onResetInteractionState()
    this.opts.store.beginPlayLoad()
    this.opts.renderer.clearMidi()
    this.opts.services.synth
      .load(midi)
      .catch((err) => console.error('SynthEngine.load failed:', err))
    this.opts.store.completePlayLoad(midi)
    this.opts.state.baseMidi = midi
    this.opts.state.transposeSemitones = 0
    this.opts.onSyncConsolePanel()
    this.opts.keyboardInput.enable()
    this.opts.ui.renderTrackPanel(midi)
    this.opts.ui.hideDropzone()
    document.title = `${midi.name} - midee`
  }

  private async loadMidi(file: File, source: 'drag' | 'picker'): Promise<void> {
    const previousMode = this.opts.store.state.mode
    const previousMidi = this.opts.store.state.loadedMidi
    this.opts.onResetInteractionState()
    this.opts.store.beginPlayLoad()
    this.opts.renderer.clearMidi()
    this.opts.showLoading()

    try {
      const midi = await parseMidiFile(file)
      await saveLocalMidi(file, midi).catch((err) => {
        console.warn('[loadMidi] saveLocalMidi failed', err)
      })
      this.opts.services.synth.load(midi).catch((err) => {
        console.error('SynthEngine.load failed:', err)
        trackEvent('synth_load_failed', { source })
      })
      if (
        !this.opts.keyboardMode.ensureMidiFitsCurrentMode(midi, midi, {
          onTranspose: (semitones) => {
            const resolvedMidi = transposeMidiFile(midi, semitones)
            this.opts.store.completePlayLoad(resolvedMidi)
            this.opts.state.baseMidi = resolvedMidi
            this.opts.state.transposeSemitones = 0
            this.opts.onSyncConsolePanel()
            this.opts.resetPlaybackTelemetry()
            trackMidiLoaded({
              source,
              trackCount: resolvedMidi.tracks.length,
              noteCount: countNotes(resolvedMidi),
              durationS: Math.round(resolvedMidi.duration),
              fileSizeKb: Math.round(file.size / 1024),
            })
          },
          onSwitchTo88: () => {
            this.opts.store.completePlayLoad(midi)
            this.opts.state.baseMidi = midi
            this.opts.state.transposeSemitones = 0
            this.opts.onSyncConsolePanel()
            this.opts.resetPlaybackTelemetry()
            trackMidiLoaded({
              source,
              trackCount: midi.tracks.length,
              noteCount: countNotes(midi),
              durationS: Math.round(midi.duration),
              fileSizeKb: Math.round(file.size / 1024),
            })
          },
        })
      ) {
        this.opts.store.setState('status', 'ready')
        return
      }
      this.opts.store.completePlayLoad(midi)
      this.opts.state.baseMidi = midi
      this.opts.state.transposeSemitones = 0
      this.opts.onSyncConsolePanel()
      this.opts.resetPlaybackTelemetry()
      trackMidiLoaded({
        source,
        trackCount: midi.tracks.length,
        noteCount: countNotes(midi),
        durationS: Math.round(midi.duration),
        fileSizeKb: Math.round(file.size / 1024),
      })
    } catch (err) {
      console.error('Failed to load MIDI:', err)
      trackMidiLoadFailed({
        source,
        errorType: await midiLoadErrorType(err, file),
        fileExt: file.name.split('.').pop()?.toLowerCase() ?? null,
        fileSizeKb: Math.round(file.size / 1024),
      })
      if (previousMode === 'play' && previousMidi) {
        this.opts.store.enterPlay()
        this.opts.renderer.loadMidi(previousMidi)
        this.opts.ui.renderTrackPanel(previousMidi)
        this.opts.ui.hideDropzone()
      } else if (previousMode === 'play') {
        this.opts.store.enterPlayLanding()
      } else if (previousMode === 'live') {
        this.enterLiveMode(false)
      } else if (previousMode === 'home') {
        this.enterHomeMode()
      } else {
        this.opts.store.setState('status', 'ready')
      }
      const msg =
        err instanceof Error && err.name === 'EmptyMidiError'
          ? t('error.midi.empty')
          : t('error.midi.parseFailed')
      this.opts.showError(msg)
    } finally {
      this.opts.hideLoading()
    }
  }

  private resolveKeyboardModeForPlayLoad(
    midi: MidiFile,
    sourceMidi: MidiFile,
    telemetry: { source: 'sample'; sampleId: string } | { source: 'picker'; target: 'play' },
    resumeDelayMs: number,
  ): boolean {
    return this.opts.keyboardMode.ensureMidiFitsCurrentMode(midi, sourceMidi, {
      onTranspose: (semitones) => {
        const resolvedMidi = transposeMidiFile(sourceMidi, semitones)
        this.loadSessionMidi(resolvedMidi)
        this.opts.resetPlaybackTelemetry()
        trackMidiLoaded({
          ...telemetry,
          trackCount: resolvedMidi.tracks.length,
          noteCount: countNotes(resolvedMidi),
          durationS: Math.round(resolvedMidi.duration),
        })
        this.resumePlaybackSoon(resumeDelayMs)
      },
      onSwitchTo88: () => {
        this.loadSessionMidi(sourceMidi)
        this.opts.resetPlaybackTelemetry()
        trackMidiLoaded({
          ...telemetry,
          trackCount: sourceMidi.tracks.length,
          noteCount: countNotes(sourceMidi),
          durationS: Math.round(sourceMidi.duration),
        })
        this.resumePlaybackSoon(resumeDelayMs)
      },
    })
  }

  private resumePlaybackSoon(delayMs: number): void {
    setTimeout(() => {
      if (this.opts.store.state.mode === 'play' && this.opts.store.state.status !== 'playing') {
        this.opts.services.clock.play()
        this.opts.store.setState('status', 'playing')
      }
    }, delayMs)
  }

  private async handoffMidiToLearn(midi: MidiFile): Promise<void> {
    const controller = await this.opts.ensureLearnController()
    if (this.opts.store.state.mode === 'learn') {
      await controller.loadPreparedMidi(midi)
      return
    }
    controller.queueMidi(midi)
    this.opts.store.setState('mode', 'learn')
  }
}
