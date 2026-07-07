import { t } from '@/i18n'
import type {
  DisplayPrefsState,
  MidiOpenSource,
  MidiOpenTarget,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import { midiLoadErrorType, track, trackEvent, trackMidiLoadFailed } from '@/services/telemetry'
import type { LearnEnterRequest } from '@/stores/app/AppCtx'
import { isLiveRouteTarget, isPlayRouteTarget } from '@/stores/routing/routeTarget'
import { parseMidiFile } from '@/types/midi/parser'
import type { MidiFile } from '@/types/midi/types'
import { MidiModeResolution } from './MidiModeResolution'
import { loadLocalMidi, recordSamplePlayback, saveLocalMidi } from './midiLibrary'
import { fetchSampleMidi, getSample } from './samples'

interface MidiLoadFlowOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
  keyboardInput: { enable(): void }
  onSyncConsolePanel: () => void
  onResetInteractionState: () => void
  handoffPreparedPlayAlong: (midi: MidiFile) => Promise<void>
  resetPlaybackTelemetry: () => void
}

export class MidiLoadFlow {
  private readonly modeResolution: MidiModeResolution

  constructor(private readonly opts: MidiLoadFlowOptions) {
    this.modeResolution = new MidiModeResolution({
      keyboardMode: opts.services.keyboardMode,
      completePlayLoad: (midi) => this.loadSessionMidi(midi),
      resetPlaybackTelemetry: opts.resetPlaybackTelemetry,
      resumePlaybackSoon: (delayMs) => this.resumePlaybackSoon(delayMs),
    })
  }

  async openFile(
    file: File,
    source: Extract<MidiOpenSource, 'drag' | 'picker'>,
    target: MidiOpenTarget,
  ): Promise<void> {
    if (target === 'learn') {
      await this.loadLearnFile(file, source)
      return
    }
    await this.loadPlayFile(file, source)
  }

  async openSample(sampleId: string, target: MidiOpenTarget): Promise<void> {
    const sample = getSample(sampleId)
    if (!sample) return

    this.opts.services.primeInteractiveAudio()
    try {
      const midi = await fetchSampleMidi(sample)
      recordSamplePlayback(sampleId)
      if (target === 'learn') {
        await this.handoffMidiToLearn(midi)
        return
      }
      this.modeResolution.resolveSessionPlayLoad(midi, midi, { source: 'sample', sampleId }, 250)
    } catch (err) {
      console.error(
        target === 'learn' ? '[openSample] learn fetch failed' : '[loadSample] fetch failed',
        err,
      )
      trackEvent('sample_load_failed', { sample_id: sampleId, target })
      this.opts.ui.showError(t('error.sample.fetchFailed'))
    }
  }

  async openLocal(id: string, target: MidiOpenTarget): Promise<void> {
    try {
      this.opts.services.primeInteractiveAudio()
      const midi = await loadLocalMidi(id)
      if (target === 'learn') {
        await this.handoffMidiToLearn(midi)
        return
      }
      this.modeResolution.resolveSessionPlayLoad(
        midi,
        midi,
        { source: 'picker', target: 'play' },
        120,
      )
    } catch (err) {
      console.error('[openLocalMidi] failed', err)
      this.opts.ui.showError(t('error.midi.parseFailed'))
    }
  }

  async enterLearn(request: LearnEnterRequest): Promise<void> {
    if (request.kind === 'empty') {
      this.opts.navigation.navigate({ kind: 'exercise', routeId: 'play-along' })
      return
    }

    if (request.kind === 'current-midi') {
      const midi = this.opts.playbackSession.state.loadedMidi
      if (!midi) return
      track('learn_from_play', { duration_s: Math.round(midi.duration) })
      await this.handoffMidiToLearn(midi)
      return
    }

    if (request.kind === 'sample') {
      await this.openSample(request.sampleId, 'learn')
      return
    }

    try {
      this.opts.services.primeInteractiveAudio()
      const midi = await loadLocalMidi(request.id)
      await this.handoffMidiToLearn(midi)
    } catch (err) {
      console.error('[enterLearn] local midi failed', err)
      this.opts.ui.showError(t('error.midi.parseFailed'))
    }
  }

  navigateLive(primeAudio = true): void {
    this.opts.navigation.enterLive(primeAudio)
  }

  loadSessionMidi(midi: MidiFile): void {
    this.opts.onResetInteractionState()
    this.opts.playbackSession.beginPlayLoad()
    this.opts.services.renderer.clearMidi()
    this.opts.services.synth
      .load(midi)
      .catch((err) => console.error('SynthEngine.load failed:', err))
    this.opts.playbackSession.completePlayLoad(midi)
    this.opts.displayPrefs.baseMidi = midi
    this.opts.displayPrefs.transposeSemitones = 0
    this.opts.onSyncConsolePanel()
    this.opts.keyboardInput.enable()
    this.opts.ui.renderTrackPanel(midi)
    this.opts.ui.hideDropzone()
    document.title = `${midi.name} - midee`
    this.opts.navigation.navigate({ kind: 'play' })
  }

  private async loadPlayFile(file: File, source: 'drag' | 'picker'): Promise<void> {
    const previousTarget = this.opts.navigation.getCurrentTarget()
    const previousMidi = this.opts.playbackSession.state.loadedMidi
    this.opts.onResetInteractionState()
    this.opts.playbackSession.beginPlayLoad()
    this.opts.services.renderer.clearMidi()
    this.opts.ui.showLoading()

    try {
      const midi = await parseMidiFile(file)
      await saveLocalMidi(file, midi).catch((err) => {
        console.warn('[loadMidi] saveLocalMidi failed', err)
      })
      if (
        !this.modeResolution.resolveFilePlayLoad(midi, midi, {
          source,
          fileSizeKb: Math.round(file.size / 1024),
        })
      ) {
        this.opts.playbackSession.setStatus('ready')
      }
    } catch (err) {
      console.error('Failed to load MIDI:', err)
      trackMidiLoadFailed({
        source,
        errorType: await midiLoadErrorType(err, file),
        fileExt: file.name.split('.').pop()?.toLowerCase() ?? null,
        fileSizeKb: Math.round(file.size / 1024),
      })
      if (isPlayRouteTarget(previousTarget) && previousMidi) {
        this.opts.playbackSession.enterPlay()
        this.opts.services.renderer.loadMidi(previousMidi)
        this.opts.ui.renderTrackPanel(previousMidi)
        this.opts.ui.hideDropzone()
      } else if (isPlayRouteTarget(previousTarget)) {
        this.opts.playbackSession.enterPlayLanding()
      } else if (isLiveRouteTarget(previousTarget)) {
        this.navigateLive(false)
      } else {
        this.opts.playbackSession.setStatus('ready')
      }
      const msg =
        err instanceof Error && err.name === 'EmptyMidiError'
          ? t('error.midi.empty')
          : t('error.midi.parseFailed')
      this.opts.ui.showError(msg)
    } finally {
      this.opts.ui.hideLoading()
    }
  }

  private resumePlaybackSoon(delayMs: number): void {
    setTimeout(() => {
      if (
        isPlayRouteTarget(this.opts.navigation.getCurrentTarget()) &&
        this.opts.playbackSession.state.status !== 'playing'
      ) {
        this.opts.services.clock.play()
        this.opts.playbackSession.setStatus('playing')
      }
    }, delayMs)
  }

  private async handoffMidiToLearn(midi: MidiFile): Promise<void> {
    await this.opts.handoffPreparedPlayAlong(midi)
  }

  private async loadLearnFile(
    file: File,
    source: Extract<MidiOpenSource, 'drag' | 'picker'>,
  ): Promise<void> {
    this.opts.services.primeInteractiveAudio()
    try {
      const midi = await parseMidiFile(file)
      await saveLocalMidi(file, midi).catch((err) => {
        console.warn('[loadLearnMidi] saveLocalMidi failed', err)
      })
      await this.handoffMidiToLearn(midi)
    } catch (err) {
      console.error('[loadLearnMidi] failed', err)
      trackMidiLoadFailed({
        source,
        target: 'learn',
        errorType: await midiLoadErrorType(err, file),
        fileExt: file.name.split('.').pop()?.toLowerCase() ?? null,
        fileSizeKb: Math.round(file.size / 1024),
      })
      const msg =
        err instanceof Error && err.name === 'EmptyMidiError'
          ? t('error.midi.empty')
          : t('error.midi.parseFailed')
      this.opts.ui.showError(msg)
    }
  }
}
