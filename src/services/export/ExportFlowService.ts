import type { ExportSettings } from '@/components/export/ExportModal'
import { t } from '@/i18n'
import { INSTRUMENTS } from '@/services/audio/SynthEngine'
import {
  fitPitchRange,
  resolveExportBitrate,
  resolveExportDims,
  speedToPps,
  trimAudioBuffer,
} from '@/services/export/exportMath'
import { midiFileToBytes, triggerMidiDownload } from '@/services/midi/MidiEncoding'
import type {
  DisplayPrefsState,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import { track, trackActivation, trackEvent } from '@/services/telemetry'
import { isPlayRouteTarget } from '@/stores/routing/routeTarget'

interface ExportFlowServiceOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
  liveNotes: { reset(): void }
  exporterRef: { current: { cancel(): void } | null }
}

function sanitiseFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : 'midee'
}

export class ExportFlowService {
  constructor(private readonly opts: ExportFlowServiceOptions) {}

  openModal(): void {
    void this.opts.ui.openExportModal()
  }

  async startExport(settings: ExportSettings): Promise<void> {
    const midi = this.opts.playbackSession.state.loadedMidi
    if (!midi || !isPlayRouteTarget(this.opts.navigation.getCurrentTarget())) return
    const exportModal = this.opts.ui.peekExportModal()
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
      this.opts.ui.showSuccess(`-> ${sanitiseFilename(midi.name)}.mid`)
      track('export_completed', {
        ...exportBase,
        elapsed_ms: Math.round(performance.now() - exportStartedAt),
      })
      return
    }

    const wasPlaying = this.opts.playbackSession.state.status === 'playing'
    const resumeAt = this.opts.services.clock.currentTime
    this.opts.services.clock.pause()
    this.opts.liveNotes.reset()
    this.opts.services.synth.liveReleaseAll()
    this.opts.playbackSession.setStatus('exporting')
    this.opts.services.synth.pause()
    this.opts.services.renderer.pauseAutoRender()

    const needsVideo = settings.output !== 'audio-only'
    const needsAudio = settings.output !== 'video-only'
    const originalCanvas = this.opts.services.renderer.canvasSize
    const target = needsVideo ? resolveExportDims(settings.resolution) : null
    const resized =
      target !== null &&
      (target.width !== originalCanvas.width || target.height !== originalCanvas.height)
    if (resized) this.opts.services.renderer.resize(target.width, target.height, 1)

    const originalPps = this.opts.services.renderer.currentPixelsPerSecond
    const originalRange = this.opts.services.renderer.pitchRange
    const isSocialFormat =
      needsVideo && (settings.resolution === 'vertical' || settings.resolution === 'square')
    let pitchChanged = false
    let ppsChanged = false
    if (isSocialFormat) {
      if (settings.focus === 'fit') {
        const fit = fitPitchRange(midi)
        this.opts.services.renderer.setPitchRange(fit.min, fit.max)
        pitchChanged = true
      }
      const pps = speedToPps(settings.speed)
      if (pps !== originalPps) {
        this.opts.services.renderer.setZoom(pps)
        ppsChanged = true
      }
    }

    const filename = settings.output === 'audio-only' ? 'midee.m4a' : 'midee.mp4'

    try {
      let audioBuffer: AudioBuffer | undefined
      if (needsAudio) {
        const { renderAudioOffline } = await import('@/services/audio/OfflineAudioRenderer')
        exportStage = 'audio_render'
        exportModal.updateProgress('Rendering audio', 0)
        try {
          audioBuffer = await renderAudioOffline({
            midi,
            instrumentId: INSTRUMENTS[this.opts.displayPrefs.currentInstrumentIndex]!.id,
            volume: this.opts.playbackSession.state.volume,
            disabledTrackIds: this.opts.services.synth.getDisabledTrackIds(),
            onRenderAudioProgressMode: (detailed) =>
              exportModal.setRenderAudioProgressMode(detailed),
            onProgress: (pct) => exportModal.updateProgress('Rendering audio', pct),
          })
        } catch (err) {
          console.error('Offline audio render failed:', err)
          if (settings.output === 'audio-only') throw err
          trackEvent('export_degraded', { stage: 'audio_render', output: settings.output })
          this.opts.ui.showError(t('error.audio.renderFailed'))
        }
      }

      exportStage = 'video_encode'
      const { VideoExporter } = await import('@/services/export/VideoExporter')
      const exporter = new VideoExporter(this.opts.services.renderer.canvas)
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
        onRenderFrame: (time, dt) => this.opts.services.renderer.renderManualFrame(time, dt),
        onProgress: (stage, pct) => exportModal.updateProgress(stage, pct),
      })

      exportModal.close()
      this.opts.ui.showSuccess(`-> ${t('toast.export.ready', { filename })}`)
      track('export_completed', {
        ...exportBase,
        elapsed_ms: Math.round(performance.now() - exportStartedAt),
      })
    } catch (err) {
      const isCancel = err instanceof DOMException && err.name === 'AbortError'
      if (!isCancel) {
        console.error('Export failed:', err)
        this.opts.ui.showError((err as Error).message || t('error.export.generic'))
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
        this.opts.services.renderer.resize(
          window.innerWidth,
          window.innerHeight,
          originalCanvas.resolution,
        )
      }
      if (pitchChanged)
        this.opts.services.renderer.setPitchRange(originalRange.min, originalRange.max)
      if (ppsChanged) this.opts.services.renderer.setZoom(originalPps)
      this.opts.services.renderer.resumeAutoRender()
      this.opts.services.clock.seek(resumeAt)
      this.opts.playbackSession.setStatus('ready')
      if (wasPlaying) {
        this.opts.services.clock.play()
        this.opts.playbackSession.setStatus('playing')
      }
    }
  }

  cancelExport(): void {
    this.opts.exporterRef.current?.cancel()
  }
}
