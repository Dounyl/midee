import { INSTRUMENTS } from '../../audio/SynthEngine'
import type { MidiFile, MidiKeySignature } from '../../core/midi/types'
import { detectChord } from '../../core/music/ChordDetector'
import { transposeMidiFile } from '../../core/music/KeySignature'
import { pitchSignature } from '../../export/exportMath'
import { t } from '../../i18n'
import type { CapturedEvent } from '../../midi/MidiEncoding'
import { encodeCapturedEvents, triggerMidiDownload } from '../../midi/MidiEncoding'
import { sessionToMidiFile } from '../../midi/SessionToMidi'
import { PARTICLE_STYLES } from '../../renderer/ParticleSystem'
import { THEMES, type Theme } from '../../renderer/theme'
import { track, trackEvent } from '../../telemetry'
import type { SessionAction } from '../../ui/PostSessionModal'
import type { KeyboardModeCoordinator } from '../KeyboardModeCoordinator'
import type { RuntimeUiBridge } from '../RuntimeUiBridge'
import type { AppRuntimeDeps, ExportOverlayState } from '../types'

interface RuntimeOverlayControllerOptions extends AppRuntimeDeps {
  ui: RuntimeUiBridge
  state: ExportOverlayState
  liveNotes: { heldNotes: ReadonlyMap<number, unknown> }
  loopNotes: { heldNotes: ReadonlyMap<number, unknown> }
  liveLooper: {
    snapshot(): { events: CapturedEvent[]; duration: number }
    layerCount: { value: number }
  }
  sessionRec: {
    recording: { value: boolean }
    start(): void
    stop(): { events: CapturedEvent[]; duration: number }
  }
  pendingSessionRef: { current: { events: CapturedEvent[]; duration: number } | null }
  loadSessionMidi: (midi: MidiFile) => void
  metronomeBpm: () => number
  isTransposeEnabled: () => boolean
  getLearnConsoleState: () => {
    enabled: boolean
    baseKey: MidiKeySignature | null
    current: number
  } | null
  keyboardMode: KeyboardModeCoordinator
}

export class RuntimeOverlayController {
  private chordLastRunMs = 0
  private chordLastSig = ''

  constructor(private readonly opts: RuntimeOverlayControllerOptions) {}

  getState(): ExportOverlayState {
    return this.opts.state
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
    void this.opts.modals.postSessionHandle.get().then((modal) => modal.open(duration, noteCount))
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

    const midi = sessionToMidiFile(
      pending.events,
      pending.duration,
      this.opts.metronomeBpm(),
      `Live session 路 ${Math.round(pending.duration)}s`,
    )
    this.opts.pendingSessionRef.current = null
    this.opts.loadSessionMidi(midi)
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
      void this.opts
        .ensureLearnController()
        .then((controller) => controller.setTranspose(semitones))
      return
    }
    if (!this.opts.isTransposeEnabled()) return
    const base = this.opts.state.baseMidi ?? this.opts.store.state.loadedMidi
    if (!base) return
    const next = Math.trunc(semitones)
    if (next === this.opts.state.transposeSemitones) return
    const midi = transposeMidiFile(base, next)
    if (
      !this.opts.keyboardMode.ensureMidiFitsCurrentMode(midi, base, {
        onTranspose: (target) => this.handleTransposeChange(target),
      })
    )
      return
    this.opts.state.transposeSemitones = next
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
