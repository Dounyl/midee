import type { LearnEnterRequest } from '@/stores/app/AppCtx'
import { parseMidiFile } from '../../core/midi/parser'
import type { MidiFile } from '../../core/midi/types'
import { loadLocalMidi, recordSamplePlayback, saveLocalMidi } from '../../core/midiLibrary'
import { fetchSampleMidi, getSample } from '../../core/samples'
import { t } from '../../i18n'
import { setNextLiveOpts } from '@/pages/LivePage/liveEnterOptions'
import {
  getCurrentLearnRoute,
  getCurrentRouteMode,
  navigateToLearnRoute,
  navigateToMode,
} from '../../routing/routerBridge'
import { midiLoadErrorType, track, trackEvent, trackMidiLoadFailed } from '../../telemetry'
import type { RuntimeUiBridge } from '../RuntimeUiBridge'
import type { AppRuntimeDeps, ExportOverlayState, MidiOpenSource, MidiOpenTarget } from '../types'
import { MidiModeResolution } from './MidiModeResolution'

interface MidiLoadFlowOptions extends AppRuntimeDeps {
  keyboardInput: { enable(): void }
  ui: RuntimeUiBridge
  state: ExportOverlayState
  onSyncConsolePanel: () => void
  onResetInteractionState: () => void
}

export class MidiLoadFlow {
  private readonly modeResolution: MidiModeResolution

  constructor(private readonly opts: MidiLoadFlowOptions) {
    this.modeResolution = new MidiModeResolution({
      keyboardMode: opts.keyboardMode,
      completePlayLoad: (midi) => this.loadSessionMidi(midi),
      resetPlaybackTelemetry: opts.resetPlaybackTelemetry,
      resumePlaybackSoon: (delayMs) => this.resumePlaybackSoon(delayMs),
    })
  }

  private currentPageMode(): 'home' | 'play' | 'live' | 'learn' {
    return getCurrentRouteMode() ?? 'home'
  }

  async openFile(
    file: File,
    source: Extract<MidiOpenSource, 'drag' | 'picker'>,
    target: MidiOpenTarget,
  ): Promise<void> {
    if (target === 'learn') {
      if (getCurrentLearnRoute() !== 'play-along') navigateToLearnRoute('play-along')
      const controller = await this.opts.ensureLearnController()
      await controller.loadMidiFromFile(file, source)
      return
    }
    await this.loadPlayFile(file, source)
  }

  async openSample(sampleId: string, target: MidiOpenTarget): Promise<void> {
    const sample = getSample(sampleId)
    if (!sample) return

    this.opts.primeInteractiveAudio()
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
      this.opts.showError(t('error.sample.fetchFailed'))
    }
  }

  async openLocal(id: string, target: MidiOpenTarget): Promise<void> {
    try {
      this.opts.primeInteractiveAudio()
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
      this.opts.showError(t('error.midi.parseFailed'))
    }
  }

  async enterLearn(request: LearnEnterRequest): Promise<void> {
    if (request.kind === 'empty') {
      navigateToLearnRoute('play-along')
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
      await this.openSample(request.sampleId, 'learn')
      return
    }

    try {
      this.opts.primeInteractiveAudio()
      const midi = await loadLocalMidi(request.id)
      await this.handoffMidiToLearn(midi)
    } catch (err) {
      console.error('[enterLearn] local midi failed', err)
      this.opts.showError(t('error.midi.parseFailed'))
    }
  }

  navigateLive(primeAudio = true): void {
    setNextLiveOpts({ primeAudio })
    navigateToMode('live')
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
    navigateToMode('play')
  }

  private async loadPlayFile(file: File, source: 'drag' | 'picker'): Promise<void> {
    const previousMode = this.currentPageMode()
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
      if (
        !this.modeResolution.resolveFilePlayLoad(midi, midi, {
          source,
          fileSizeKb: Math.round(file.size / 1024),
        })
      ) {
        this.opts.store.setState('status', 'ready')
      }
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
        this.navigateLive(false)
      } else if (previousMode === 'home') {
        navigateToMode('home')
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

  private resumePlaybackSoon(delayMs: number): void {
    setTimeout(() => {
      if (this.currentPageMode() === 'play' && this.opts.store.state.status !== 'playing') {
        this.opts.services.clock.play()
        this.opts.store.setState('status', 'playing')
      }
    }, delayMs)
  }

  private async handoffMidiToLearn(midi: MidiFile): Promise<void> {
    const controller = await this.opts.ensureLearnController()
    if (getCurrentLearnRoute() === 'play-along') {
      await controller.loadPreparedMidi(midi)
      return
    }
    controller.queueMidi(midi)
    navigateToLearnRoute('play-along')
  }
}
