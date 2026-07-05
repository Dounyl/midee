import { INSTRUMENTS } from '../../audio/SynthEngine'
import {
  fitPitchRange,
  resolveExportBitrate,
  resolveExportDims,
  speedToPps,
  trimAudioBuffer,
} from '../../export/exportMath'
import { t } from '../../i18n'
import { midiFileToBytes, triggerMidiDownload } from '../../midi/MidiEncoding'
import { getCurrentRouteMode } from '../../routing/routerBridge'
import { track, trackActivation, trackEvent } from '../../telemetry'
import type { ExportSettings } from '../../ui/ExportModal'
import type { AppRuntimeDeps, ExportOverlayState } from '../types'
import { sanitiseFilename } from '../utils'

interface ExportFlowServiceOptions extends AppRuntimeDeps {
  state: ExportOverlayState
  liveNotes: { reset(): void }
  exporterRef: { current: { cancel(): void } | null }
}

export class ExportFlowService {
  constructor(private readonly opts: ExportFlowServiceOptions) {}

  private currentPageMode() {
    return getCurrentRouteMode() ?? 'home'
  }

  openModal(): void {
    void this.opts.modals.exportHandle.get().then((modal) => modal.open())
  }

  async startExport(settings: ExportSettings): Promise<void> {
    const midi = this.opts.store.state.loadedMidi
    if (!midi || this.currentPageMode() !== 'play') return
    const exportModal = this.opts.modals.exportHandle.peek()
    if (!exportModal) return

    const exportStartedAt = performance.now()
    const exportBase = {
      output: settings.output,
      resolution: settings.resolution,
      fps: settings.fps,
      focus: settings.focus,
      speed: settings.speed,
      midi_duration_s: Math.round(midi.duration),
    }
    let exportStage: 'serialize' | 'audio_render' | 'video_encode' = 'serialize'
    track('export_started', exportBase)
    trackActivation('export_started')

    if (settings.output === 'midi') {
      const bytes = await midiFileToBytes(midi)
      triggerMidiDownload(bytes, `${sanitiseFilename(midi.name)}.mid`)
      exportModal.close()
      this.opts.showSuccess(`-> ${sanitiseFilename(midi.name)}.mid`)
      track('export_completed', {
        ...exportBase,
        elapsed_ms: Math.round(performance.now() - exportStartedAt),
      })
      return
    }

    const wasPlaying = this.opts.store.state.status === 'playing'
    const resumeAt = this.opts.services.clock.currentTime
    this.opts.services.clock.pause()
    this.opts.liveNotes.reset()
    this.opts.services.synth.liveReleaseAll()
    this.opts.store.setState('status', 'exporting')
    this.opts.services.synth.pause()
    this.opts.renderer.pauseAutoRender()

    const needsVideo = settings.output !== 'audio-only'
    const needsAudio = settings.output !== 'video-only'
    const originalCanvas = this.opts.renderer.canvasSize
    const target = needsVideo ? resolveExportDims(settings.resolution) : null
    const resized =
      target !== null &&
      (target.width !== originalCanvas.width || target.height !== originalCanvas.height)
    if (resized) this.opts.renderer.resize(target.width, target.height, 1)

    const originalPps = this.opts.renderer.currentPixelsPerSecond
    const originalRange = this.opts.renderer.pitchRange
    const isSocialFormat =
      needsVideo && (settings.resolution === 'vertical' || settings.resolution === 'square')
    let pitchChanged = false
    let ppsChanged = false
    if (isSocialFormat) {
      if (settings.focus === 'fit') {
        const fit = fitPitchRange(midi)
        this.opts.renderer.setPitchRange(fit.min, fit.max)
        pitchChanged = true
      }
      const pps = speedToPps(settings.speed)
      if (pps !== originalPps) {
        this.opts.renderer.setZoom(pps)
        ppsChanged = true
      }
    }

    const filename = settings.output === 'audio-only' ? 'midee.m4a' : 'midee.mp4'

    try {
      let audioBuffer: AudioBuffer | undefined
      if (needsAudio) {
        const { renderAudioOffline } = await import('../../audio/OfflineAudioRenderer')
        exportStage = 'audio_render'
        exportModal.updateProgress('Rendering audio', 0)
        try {
          audioBuffer = await renderAudioOffline({
            midi,
            instrumentId: INSTRUMENTS[this.opts.state.currentInstrumentIndex]!.id,
            volume: this.opts.store.state.volume,
            disabledTrackIds: this.opts.services.synth.getDisabledTrackIds(),
            onRenderAudioProgressMode: (detailed) =>
              exportModal.setRenderAudioProgressMode(detailed),
            onProgress: (pct) => exportModal.updateProgress('Rendering audio', pct),
          })
        } catch (err) {
          console.error('Offline audio render failed:', err)
          if (settings.output === 'audio-only') throw err
          trackEvent('export_degraded', { stage: 'audio_render', output: settings.output })
          this.opts.showError(t('error.audio.renderFailed'))
        }
      }

      exportStage = 'video_encode'
      const { VideoExporter } = await import('../../export/VideoExporter')
      const exporter = new VideoExporter(this.opts.renderer.canvas)
      this.opts.exporterRef.current = exporter

      const exportAudio =
        audioBuffer && settings.output === 'av'
          ? trimAudioBuffer(audioBuffer, midi.duration)
          : audioBuffer

      await exporter.export({
        fps: settings.fps,
        duration: midi.duration,
        mode: settings.output,
        filename,
        bitrate: resolveExportBitrate(settings.resolution),
        ...(exportAudio ? { audio: exportAudio } : {}),
        onSeek: (time) => this.opts.services.clock.seek(time),
        onRenderFrame: (time, dt) => this.opts.renderer.renderManualFrame(time, dt),
        onProgress: (stage, pct) => exportModal.updateProgress(stage, pct),
      })

      exportModal.close()
      this.opts.showSuccess(`-> ${t('toast.export.ready', { filename })}`)
      track('export_completed', {
        ...exportBase,
        elapsed_ms: Math.round(performance.now() - exportStartedAt),
      })
    } catch (err) {
      const isCancel = err instanceof DOMException && err.name === 'AbortError'
      if (!isCancel) {
        console.error('Export failed:', err)
        this.opts.showError((err as Error).message || t('error.export.generic'))
      }
      track(isCancel ? 'export_cancelled' : 'export_failed', {
        ...exportBase,
        stage: exportStage,
        elapsed_ms: Math.round(performance.now() - exportStartedAt),
      })
      exportModal.close()
    } finally {
      this.opts.exporterRef.current = null
      if (resized) {
        this.opts.renderer.resize(window.innerWidth, window.innerHeight, originalCanvas.resolution)
      }
      if (pitchChanged) this.opts.renderer.setPitchRange(originalRange.min, originalRange.max)
      if (ppsChanged) this.opts.renderer.setZoom(originalPps)
      this.opts.renderer.resumeAutoRender()
      this.opts.services.clock.seek(resumeAt)
      this.opts.store.setState('status', 'ready')
      if (wasPlaying) {
        this.opts.services.clock.play()
        this.opts.store.setState('status', 'playing')
      }
    }
  }

  cancelExport(): void {
    this.opts.exporterRef.current?.cancel()
  }
}
