import { INSTRUMENTS, type SynthEngine } from '../audio/SynthEngine'
import type { MidiKeySignature } from '../core/midi/types'
import { detectChord } from '../core/music/ChordDetector'
import { transposeMidiFile } from '../core/music/KeySignature'
import {
  fitPitchRange,
  pitchSignature,
  resolveExportBitrate,
  resolveExportDims,
  speedToPps,
  trimAudioBuffer,
} from '../export/exportMath'
import { t } from '../i18n'
import type { LiveLooper } from '../midi/LiveLooper'
import type { LiveNoteStore } from '../midi/LiveNoteStore'
import type { CapturedEvent } from '../midi/MidiEncoding'
import { encodeCapturedEvents, midiFileToBytes, triggerMidiDownload } from '../midi/MidiEncoding'
import type { SessionRecorder } from '../midi/SessionRecorder'
import { sessionToMidiFile } from '../midi/SessionToMidi'
import { PARTICLE_STYLES } from '../renderer/ParticleSystem'
import type { PianoRollRenderer } from '../renderer/PianoRollRenderer'
import { THEMES, type Theme } from '../renderer/theme'
import type { AppStore } from '../store/state'
import { track, trackActivation, trackEvent } from '../telemetry'
import type { ExportSettings } from '../ui/ExportModal'
import type { SessionAction } from '../ui/PostSessionModal'
import type { KeyboardModeCoordinator } from './KeyboardModeCoordinator'
import type { RuntimeUiBridge } from './RuntimeUiBridge'
import type { AppRuntimeDeps, ExportOverlayState } from './types'
import { sanitiseFilename } from './utils'

interface ExportAndOverlayCoordinatorOptions extends AppRuntimeDeps {
  store: AppStore
  renderer: PianoRollRenderer
  synth: SynthEngine
  liveNotes: LiveNoteStore
  loopNotes: LiveNoteStore
  liveLooper: LiveLooper
  sessionRec: SessionRecorder
  ui: RuntimeUiBridge
  state: ExportOverlayState
  exporterRef: { current: { cancel(): void } | null }
  pendingSessionRef: { current: { events: CapturedEvent[]; duration: number } | null }
  loadSessionMidi: (midi: import('../core/midi/types').MidiFile) => void
  metronomeBpm: () => number
  isTransposeEnabled: () => boolean
  getLearnConsoleState: () => {
    enabled: boolean
    baseKey: MidiKeySignature | null
    current: number
  } | null
  keyboardMode: KeyboardModeCoordinator
}

export class ExportAndOverlayCoordinator {
  private chordLastRunMs = 0
  private chordLastSig = ''

  constructor(private readonly opts: ExportAndOverlayCoordinatorOptions) {}

  async startExport(settings: ExportSettings): Promise<void> {
    const midi = this.opts.store.state.loadedMidi
    if (!midi || this.opts.store.state.mode !== 'play') return
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
    this.opts.synth.liveReleaseAll()
    this.opts.store.setState('status', 'exporting')
    this.opts.synth.pause()
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
        const { renderAudioOffline } = await import('../audio/OfflineAudioRenderer')
        exportStage = 'audio_render'
        exportModal.updateProgress('Rendering audio', 0)
        try {
          audioBuffer = await renderAudioOffline({
            midi,
            instrumentId: INSTRUMENTS[this.opts.state.currentInstrumentIndex]!.id,
            volume: this.opts.store.state.volume,
            disabledTrackIds: this.opts.synth.getDisabledTrackIds(),
            onRenderAudioProgressMode: (d) => exportModal.setRenderAudioProgressMode(d),
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
      const { VideoExporter } = await import('../export/VideoExporter')
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
        onSeek: (t) => this.opts.services.clock.seek(t),
        onRenderFrame: (t, dt) => this.opts.renderer.renderManualFrame(t, dt),
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

  toggleSessionRecord(): void {
    if (!this.opts.sessionRec.recording.value) {
      this.opts.primeInteractiveAudio()
      this.opts.sessionRec.start()
      track('session_started')
      return
    }
    const { events, duration } = this.opts.sessionRec.stop()
    if (events.length === 0) {
      this.opts.showError(t('toast.recording.empty'))
      track('session_record_empty')
      return
    }
    this.opts.pendingSessionRef.current = { events, duration }
    const noteCount = events.reduce((n, e) => n + (e.type === 'on' ? 1 : 0), 0)
    void this.opts.modals.postSessionHandle.get().then((m) => m.open(duration, noteCount))
    track('session_recorded', { duration_s: Math.round(duration), notes: noteCount })
  }

  async handleSessionAction(action: SessionAction): Promise<void> {
    const pending = this.opts.pendingSessionRef.current
    this.opts.modals.postSessionHandle.peek()?.close()
    if (!pending) return

    track('session_action', { action, duration_s: Math.round(pending.duration) })

    if (action === 'discard') {
      this.opts.pendingSessionRef.current = null
      return
    }

    if (action === 'download') {
      const bytes = await encodeCapturedEvents(pending.events, {
        bpm: this.opts.metronomeBpm(),
        closeOrphansAt: pending.duration,
        midiName: 'midee session',
        trackName: 'Live performance',
      })
      triggerMidiDownload(bytes, 'midee-session.mid')
      this.opts.showSuccess(
        `-> ${t('toast.session.saved', { seconds: Math.round(pending.duration) })}`,
      )
      this.opts.pendingSessionRef.current = null
      return
    }

    if (action === 'open-in-file') {
      const midi = sessionToMidiFile(
        pending.events,
        pending.duration,
        this.opts.metronomeBpm(),
        `Live session · ${Math.round(pending.duration)}s`,
      )
      this.opts.pendingSessionRef.current = null
      this.opts.loadSessionMidi(midi)
    }
  }

  async saveLoopAsMidi(): Promise<void> {
    const snap = this.opts.liveLooper.snapshot()
    if (snap.events.length === 0) return
    const bytes = await encodeCapturedEvents(snap.events, {
      bpm: this.opts.metronomeBpm(),
      closeOrphansAt: snap.duration,
      midiName: 'midee loop',
      trackName: 'Loop',
    })
    triggerMidiDownload(bytes, 'midee-loop.mid')
    this.opts.showSuccess(`-> ${t('toast.loop.saved')}`)
    track('loop_saved', {
      duration_s: Math.round(snap.duration),
      layers: this.opts.liveLooper.layerCount.value,
    })
  }

  handleTransposeChange(semitones: number): void {
    if (this.opts.store.state.mode === 'learn') {
      void this.opts.ensureLearnController().then((c) => c.setTranspose(semitones))
      return
    }
    if (!this.opts.isTransposeEnabled()) return
    const base = this.opts.state.baseMidi ?? this.opts.store.state.loadedMidi
    if (!base) return
    const next = Math.trunc(semitones)
    if (next === this.opts.state.transposeSemitones) return
    this.opts.state.transposeSemitones = next
    const midi = transposeMidiFile(base, next)
    this.opts.store.replaceLoadedMidi(midi)
    this.opts.renderer.loadMidi(midi)
    this.opts.ui.renderTrackPanel(midi)
    this.syncConsolePanel()
  }

  syncConsolePanel(): void {
    if (this.opts.store.state.mode === 'learn') {
      const state = this.opts.getLearnConsoleState() ?? {
        enabled: false,
        baseKey: null,
        current: 0,
      }
      this.opts.ui.updateConsoleState(
        state.enabled,
        state.baseKey,
        state.current,
        this.opts.keyboardMode.getMode(),
        this.opts.state.pitchLabelsVisible,
      )
      return
    }

    const baseKey =
      this.opts.store.state.mode === 'play'
        ? (this.opts.state.baseMidi?.keySignature ?? null)
        : null
    this.opts.ui.updateConsoleState(
      this.opts.isTransposeEnabled(),
      baseKey,
      this.opts.state.transposeSemitones,
      this.opts.keyboardMode.getMode(),
      this.opts.state.pitchLabelsVisible,
    )
  }

  setPitchLabelsVisible(visible: boolean): void {
    if (this.opts.state.pitchLabelsVisible === visible) return
    this.opts.state.pitchLabelsVisible = visible
    this.opts.persistence.pitchLabels.save(visible)
    this.opts.renderer.setPitchLabelsVisible(visible)
    this.syncConsolePanel()
  }

  toggleChordOverlay(): void {
    this.opts.state.chordOverlayOn = !this.opts.state.chordOverlayOn
    this.applyChordOverlayVisibility()
    this.opts.ui.setChord(this.opts.state.chordOverlayOn)
    this.opts.persistence.chordOverlay.save(this.opts.state.chordOverlayOn)
    track('chord_overlay_toggled', { on: this.opts.state.chordOverlayOn })
    if (this.opts.state.chordOverlayOn && this.opts.ui.chordVisible) {
      this.chordLastSig = ''
      this.chordLastRunMs = 0
      this.maybeUpdateChordOverlay(this.opts.services.clock.currentTime)
    }
  }

  applyChordOverlayVisibility(): void {
    const allowedHere = this.opts.store.state.mode !== 'play'
    this.opts.ui.setChordVisible(this.opts.state.chordOverlayOn && allowedHere)
  }

  maybeUpdateChordOverlay(time: number): void {
    if (!this.opts.state.chordOverlayOn) return
    const now = performance.now()
    const pitches = this.collectActivePitches(time)
    const sig = pitchSignature(pitches)
    if (sig === this.chordLastSig && now - this.chordLastRunMs < 250) return
    if (sig !== this.chordLastSig || now - this.chordLastRunMs >= 70) {
      this.chordLastSig = sig
      this.chordLastRunMs = now
      this.opts.ui.updateChord(detectChord(pitches))
    }
  }

  cycleTheme(): void {
    this.setThemeByIndex((this.opts.state.currentThemeIndex + 1) % THEMES.length)
  }

  setThemeByIndex(index: number): void {
    if (index < 0 || index >= THEMES.length || index === this.opts.state.currentThemeIndex) return
    this.opts.state.currentThemeIndex = index
    this.applyTheme(THEMES[index]!)
    this.opts.persistence.themeIndex.save(index)
    trackEvent('theme_changed', { theme: THEMES[index]!.name })
  }

  cycleInstrument(): void {
    const from = INSTRUMENTS[this.opts.state.currentInstrumentIndex]?.id
    this.opts.state.currentInstrumentIndex =
      (this.opts.state.currentInstrumentIndex + 1) % INSTRUMENTS.length
    this.applyInstrument()
    this.opts.persistence.instrumentIndex.save(this.opts.state.currentInstrumentIndex)
    trackEvent('instrument_changed', {
      from,
      to: INSTRUMENTS[this.opts.state.currentInstrumentIndex]!.id,
      method: 'cycle',
    })
  }

  setInstrumentById(id: string): void {
    const index = INSTRUMENTS.findIndex((instrument) => instrument.id === id)
    if (index < 0 || index === this.opts.state.currentInstrumentIndex) return
    const from = INSTRUMENTS[this.opts.state.currentInstrumentIndex]?.id
    this.opts.state.currentInstrumentIndex = index
    this.applyInstrument()
    this.opts.persistence.instrumentIndex.save(index)
    trackEvent('instrument_changed', { from, to: id, method: 'menu' })
  }

  cycleParticleStyle(): void {
    this.setParticleByIndex((this.opts.state.currentParticleIndex + 1) % PARTICLE_STYLES.length)
  }

  setParticleByIndex(index: number): void {
    if (
      index < 0 ||
      index >= PARTICLE_STYLES.length ||
      index === this.opts.state.currentParticleIndex
    ) {
      return
    }
    this.opts.state.currentParticleIndex = index
    this.applyParticleStyle()
    this.opts.persistence.particleIndex.save(index)
    trackEvent('particle_changed', { style: PARTICLE_STYLES[index]!.id })
  }

  applyTheme(theme: Theme): void {
    this.opts.renderer.setTheme(theme)
    this.opts.ui.setTheme(theme, this.opts.state.currentThemeIndex)
    const accent = theme.uiAccentCSS
    document.documentElement.style.setProperty('--accent', accent)
    document.documentElement.style.setProperty('--accent-soft', `${accent}2e`)
    document.documentElement.style.setProperty('--accent-glow', `${accent}66`)
  }

  applyInstrument(): void {
    const info = INSTRUMENTS[this.opts.state.currentInstrumentIndex]!
    this.opts.ui.setInstrumentLabel(t(info.nameKey))
    this.opts.ui.setCurrentInstrument(info.id)
    void this.opts.services.synth.setInstrument(info.id)
  }

  applyParticleStyle(): void {
    const info = PARTICLE_STYLES[this.opts.state.currentParticleIndex]!
    this.opts.renderer.setParticleStyle(info.id)
    this.opts.ui.setParticle(this.opts.state.currentParticleIndex)
  }

  private collectActivePitches(currentTime: number): Set<number> {
    const pitches = new Set<number>()
    const mode = this.opts.store.state.mode

    if (mode === 'live' || mode === 'home') {
      for (const [pitch] of this.opts.liveNotes.heldNotes) pitches.add(pitch)
      for (const [pitch] of this.opts.loopNotes.heldNotes) pitches.add(pitch)
      return pitches
    }

    if (mode === 'play') {
      const midi = this.opts.store.state.loadedMidi
      if (midi) {
        for (const track of midi.tracks) {
          if (!this.opts.renderer.isTrackVisible(track.id)) continue
          if (track.isDrum) continue
          for (const note of track.notes) {
            if (note.time > currentTime) break
            if (note.time + note.duration > currentTime) pitches.add(note.pitch)
          }
        }
      }
      for (const [pitch] of this.opts.liveNotes.heldNotes) pitches.add(pitch)
    }

    return pitches
  }
}
