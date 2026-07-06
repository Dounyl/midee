import type { SessionAction } from '@/components/export/PostSessionModal'
import { track, trackEvent } from '@/features/telemetry'
import { t } from '@/i18n'
import { detectChord } from '@/lib/music/ChordDetector'
import { transposeMidiFile } from '@/lib/music/KeySignature'
import { INSTRUMENTS } from '@/services/audio/SynthEngine'
import { pitchSignature } from '@/services/export/exportMath'
import type { CapturedEvent } from '@/services/midi/MidiEncoding'
import { encodeCapturedEvents, triggerMidiDownload } from '@/services/midi/MidiEncoding'
import { sessionToMidiFile } from '@/services/midi/SessionToMidi'
import { PARTICLE_STYLES } from '@/services/renderer/ParticleSystem'
import { THEMES, type Theme } from '@/services/renderer/theme'
import type {
  DisplayPrefsState,
  LearnRuntimeRegistryPort,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import { routeTargetToMode } from '@/stores/routing/routeTarget'
import type { MidiFile } from '@/types/midi/types'

interface RuntimeOverlayControllerOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  learnRuntimeRegistry: LearnRuntimeRegistryPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
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
}

export class RuntimeOverlayController {
  private chordLastRunMs = 0
  private chordLastSig = ''

  constructor(private readonly opts: RuntimeOverlayControllerOptions) {}

  private currentPageMode() {
    const target = this.opts.navigation.getCurrentTarget()
    return target ? routeTargetToMode(target) : 'home'
  }

  getState(): DisplayPrefsState {
    return this.opts.displayPrefs
  }

  toggleSessionRecord(): void {
    if (!this.opts.sessionRec.recording.value) {
      this.opts.services.primeInteractiveAudio()
      this.opts.sessionRec.start()
      track('session_started')
      return
    }
    const { events, duration } = this.opts.sessionRec.stop()
    if (events.length === 0) {
      this.opts.ui.showError(t('toast.recording.empty'))
      track('session_record_empty')
      return
    }
    this.opts.pendingSessionRef.current = { events, duration }
    const noteCount = events.reduce((n, e) => n + (e.type === 'on' ? 1 : 0), 0)
    void this.opts.ui.openPostSession(duration, noteCount)
    track('session_recorded', { duration_s: Math.round(duration), notes: noteCount })
  }

  async handleSessionAction(action: SessionAction): Promise<void> {
    const pending = this.opts.pendingSessionRef.current
    this.opts.ui.closePostSession()
    if (!pending) return

    track('session_action', { action, duration_s: Math.round(pending.duration) })

    if (action === 'discard') {
      this.opts.pendingSessionRef.current = null
      return
    }

    if (action === 'download') {
      const bytes = await encodeCapturedEvents(pending.events, {
        bpm: this.opts.services.metronome.bpm.value,
        closeOrphansAt: pending.duration,
        midiName: 'midee session',
        trackName: 'Live performance',
      })
      triggerMidiDownload(bytes, 'midee-session.mid')
      this.opts.ui.showSuccess(
        `-> ${t('toast.session.saved', { seconds: Math.round(pending.duration) })}`,
      )
      this.opts.pendingSessionRef.current = null
      return
    }

    const midi = sessionToMidiFile(
      pending.events,
      pending.duration,
      this.opts.services.metronome.bpm.value,
      `Live session ${Math.round(pending.duration)}s`,
    )
    this.opts.pendingSessionRef.current = null
    this.opts.loadSessionMidi(midi)
  }

  async saveLoopAsMidi(): Promise<void> {
    const snap = this.opts.liveLooper.snapshot()
    if (snap.events.length === 0) return
    const bytes = await encodeCapturedEvents(snap.events, {
      bpm: this.opts.services.metronome.bpm.value,
      closeOrphansAt: snap.duration,
      midiName: 'midee loop',
      trackName: 'Loop',
    })
    triggerMidiDownload(bytes, 'midee-loop.mid')
    this.opts.ui.showSuccess(`-> ${t('toast.loop.saved')}`)
    track('loop_saved', {
      duration_s: Math.round(snap.duration),
      layers: this.opts.liveLooper.layerCount.value,
    })
  }

  handleTransposeChange(semitones: number): void {
    if (this.currentPageMode() === 'learn') {
      this.opts.learnRuntimeRegistry.getTransposeAwareRuntime()?.setTranspose(semitones)
      return
    }
    if (!this.isTransposeEnabled()) return
    const base = this.opts.displayPrefs.baseMidi ?? this.opts.playbackSession.state.loadedMidi
    if (!base) return
    const next = Math.trunc(semitones)
    if (next === this.opts.displayPrefs.transposeSemitones) return
    const midi = transposeMidiFile(base, next)
    if (
      !this.opts.services.keyboardMode.ensureMidiFitsCurrentMode(midi, base, {
        onTranspose: (target) => this.handleTransposeChange(target),
      })
    ) {
      return
    }
    this.opts.displayPrefs.transposeSemitones = next
    this.opts.playbackSession.replaceLoadedMidi(midi)
    this.opts.services.renderer.loadMidi(midi)
    this.opts.ui.renderTrackPanel(midi)
    this.syncConsolePanel()
  }

  syncConsolePanel(): void {
    if (this.currentPageMode() === 'learn') {
      const state = this.opts.learnRuntimeRegistry.getConsoleStateProvider()?.getConsoleState() ?? {
        enabled: false,
        baseKey: null,
        current: 0,
      }
      this.opts.ui.updateConsoleState(
        state.enabled,
        state.baseKey,
        state.current,
        this.opts.services.keyboardMode.getMode(),
        this.opts.displayPrefs.pitchLabelsVisible,
      )
      return
    }

    const baseKey =
      this.currentPageMode() === 'play'
        ? (this.opts.displayPrefs.baseMidi?.keySignature ?? null)
        : null
    this.opts.ui.updateConsoleState(
      this.isTransposeEnabled(),
      baseKey,
      this.opts.displayPrefs.transposeSemitones,
      this.opts.services.keyboardMode.getMode(),
      this.opts.displayPrefs.pitchLabelsVisible,
    )
  }

  setPitchLabelsVisible(visible: boolean): void {
    if (this.opts.displayPrefs.pitchLabelsVisible === visible) return
    this.opts.displayPrefs.pitchLabelsVisible = visible
    this.opts.displayPrefs.savePitchLabels(visible)
    this.opts.services.renderer.setPitchLabelsVisible(visible)
    this.syncConsolePanel()
  }

  toggleChordOverlay(): void {
    this.opts.displayPrefs.chordOverlayOn = !this.opts.displayPrefs.chordOverlayOn
    this.applyChordOverlayVisibility()
    this.opts.ui.setChord(this.opts.displayPrefs.chordOverlayOn)
    this.opts.displayPrefs.saveChordOverlay(this.opts.displayPrefs.chordOverlayOn)
    track('chord_overlay_toggled', { on: this.opts.displayPrefs.chordOverlayOn })
    if (this.opts.displayPrefs.chordOverlayOn && this.opts.ui.isChordVisible()) {
      this.chordLastSig = ''
      this.chordLastRunMs = 0
      this.maybeUpdateChordOverlay(this.opts.services.clock.currentTime)
    }
  }

  applyChordOverlayVisibility(): void {
    const allowedHere = this.currentPageMode() !== 'play'
    this.opts.ui.setChordVisible(this.opts.displayPrefs.chordOverlayOn && allowedHere)
  }

  maybeUpdateChordOverlay(time: number): void {
    if (!this.opts.displayPrefs.chordOverlayOn) return
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
    this.setThemeByIndex((this.opts.displayPrefs.currentThemeIndex + 1) % THEMES.length)
  }

  setThemeByIndex(index: number): void {
    if (index < 0 || index >= THEMES.length || index === this.opts.displayPrefs.currentThemeIndex) {
      return
    }
    this.opts.displayPrefs.currentThemeIndex = index
    this.applyTheme(THEMES[index]!)
    this.opts.displayPrefs.saveThemeIndex(index)
    trackEvent('theme_changed', { theme: THEMES[index]!.name })
  }

  cycleInstrument(): void {
    const from = INSTRUMENTS[this.opts.displayPrefs.currentInstrumentIndex]?.id
    this.opts.displayPrefs.currentInstrumentIndex =
      (this.opts.displayPrefs.currentInstrumentIndex + 1) % INSTRUMENTS.length
    this.applyInstrument()
    this.opts.displayPrefs.saveInstrumentIndex(this.opts.displayPrefs.currentInstrumentIndex)
    trackEvent('instrument_changed', {
      from,
      to: INSTRUMENTS[this.opts.displayPrefs.currentInstrumentIndex]!.id,
      method: 'cycle',
    })
  }

  setInstrumentById(id: string): void {
    const index = INSTRUMENTS.findIndex((instrument) => instrument.id === id)
    if (index < 0 || index === this.opts.displayPrefs.currentInstrumentIndex) return
    const from = INSTRUMENTS[this.opts.displayPrefs.currentInstrumentIndex]?.id
    this.opts.displayPrefs.currentInstrumentIndex = index
    this.applyInstrument()
    this.opts.displayPrefs.saveInstrumentIndex(index)
    trackEvent('instrument_changed', { from, to: id, method: 'menu' })
  }

  cycleParticleStyle(): void {
    this.setParticleByIndex(
      (this.opts.displayPrefs.currentParticleIndex + 1) % PARTICLE_STYLES.length,
    )
  }

  setParticleByIndex(index: number): void {
    if (
      index < 0 ||
      index >= PARTICLE_STYLES.length ||
      index === this.opts.displayPrefs.currentParticleIndex
    ) {
      return
    }
    this.opts.displayPrefs.currentParticleIndex = index
    this.applyParticleStyle()
    this.opts.displayPrefs.saveParticleIndex(index)
    trackEvent('particle_changed', { style: PARTICLE_STYLES[index]!.id })
  }

  applyTheme(theme: Theme): void {
    this.opts.services.renderer.setTheme(theme)
    this.opts.ui.setTheme(theme, this.opts.displayPrefs.currentThemeIndex)
    const accent = theme.uiAccentCSS
    document.documentElement.style.setProperty('--accent', accent)
    document.documentElement.style.setProperty('--accent-soft', `${accent}2e`)
    document.documentElement.style.setProperty('--accent-glow', `${accent}66`)
  }

  applyInstrument(): void {
    const info = INSTRUMENTS[this.opts.displayPrefs.currentInstrumentIndex]!
    this.opts.ui.setInstrumentLabel(t(info.nameKey))
    this.opts.ui.setCurrentInstrument(info.id)
    void this.opts.services.synth.setInstrument(info.id)
  }

  applyParticleStyle(): void {
    const info = PARTICLE_STYLES[this.opts.displayPrefs.currentParticleIndex]!
    this.opts.services.renderer.setParticleStyle(info.id)
    this.opts.ui.setParticle(this.opts.displayPrefs.currentParticleIndex)
  }

  private collectActivePitches(currentTime: number): Set<number> {
    const pitches = new Set<number>()
    const mode = this.currentPageMode()

    if (mode === 'live' || mode === 'home') {
      for (const [pitch] of this.opts.liveNotes.heldNotes) pitches.add(pitch)
      for (const [pitch] of this.opts.loopNotes.heldNotes) pitches.add(pitch)
      return pitches
    }

    if (mode === 'play') {
      const midi = this.opts.playbackSession.state.loadedMidi
      if (midi) {
        for (const track of midi.tracks) {
          if (!this.opts.services.renderer.isTrackVisible(track.id)) continue
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

  private isTransposeEnabled(): boolean {
    return (
      this.currentPageMode() === 'play' &&
      this.opts.displayPrefs.baseMidi !== null &&
      this.opts.playbackSession.state.status !== 'playing' &&
      this.opts.playbackSession.state.status !== 'loading' &&
      this.opts.playbackSession.state.status !== 'exporting'
    )
  }
}
