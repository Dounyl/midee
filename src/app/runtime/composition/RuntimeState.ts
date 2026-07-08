import type { MidiFile, MidiKeySignature } from '@/types/midi/types'
import type { CapturedEvent } from '@/services/midi/MidiEncoding'
import type { VideoExporter } from '@/services/export/VideoExporter'
import type { AppStore } from '@/stores/app/state'

// Forward declare the port types to avoid circular dependencies
interface DisplayPrefsStatePort {
  getBaseMidi(): MidiFile | null
  setBaseMidi(value: MidiFile | null): void
  getTransposeSemitones(): number
  setTransposeSemitones(value: number): void
  getPitchLabelsVisible(): boolean
  setPitchLabelsVisible(value: boolean): void
  getChordOverlayOn(): boolean
  setChordOverlayOn(value: boolean): void
  getThemeIndex(): number
  setThemeIndex(value: number): void
  getInstrumentIndex(): number
  setInstrumentIndex(value: number): void
  getParticleIndex(): number
  setParticleIndex(value: number): void
  saveThemeIndex(value: number): void
  saveInstrumentIndex(value: number): void
  saveParticleIndex(value: number): void
  saveChordOverlay(value: boolean): void
  savePitchLabels(value: boolean): void
}

interface PlaybackSessionStatePort {
  getRecording(): boolean
  getElapsedSec(): number
}

/**
 * RuntimeState
 *
 * 持有 runtime 状态（preferences + flags + lazy resources）。
 * 职责：
 * - 管理显示偏好（theme, instrument, particles 等）
 * - 管理运行时 flags（audioPrimed, telemetry flags）
 * - 持有 lazy 资源引用（exporter, pending session）
 * - 提供状态重置方法
 */
export class RuntimeState {
  // ========== Display Preferences ==========
  baseMidi: MidiFile | null = null
  transposeSemitones = 0
  chordOverlayOn: boolean
  pitchLabelsVisible: boolean
  themeIndex: number
  instrumentIndex: number
  particleIndex: number

  // ========== Runtime Flags ==========
  audioPrimed = false
  firstPlayLogged = false
  firstPedalLogged = false
  playbackMilestones = new Set<number>()

  // ========== Lazy Resources ==========
  currentExporter: VideoExporter | null = null
  pendingSession: { events: CapturedEvent[]; duration: number } | null = null

  // ========== State Ports（用于 coordinators） ==========
  readonly displayPrefs: DisplayPrefsStatePort
  readonly playbackSession: PlaybackSessionStatePort

  constructor(
    hydratedPreferences: {
      chordOverlay: boolean
      pitchLabels: boolean
      themeIndex: number
      instrumentIndex: number
      particleIndex: number
    },
    createDisplayPrefsState: (state: RuntimeState) => DisplayPrefsStatePort,
    createPlaybackSessionState: () => PlaybackSessionStatePort,
  ) {
    this.chordOverlayOn = hydratedPreferences.chordOverlay
    this.pitchLabelsVisible = hydratedPreferences.pitchLabels
    this.themeIndex = hydratedPreferences.themeIndex
    this.instrumentIndex = hydratedPreferences.instrumentIndex
    this.particleIndex = hydratedPreferences.particleIndex

    this.displayPrefs = createDisplayPrefsState(this)
    this.playbackSession = createPlaybackSessionState()
  }

  /**
   * 重置播放相关的 telemetry flags
   */
  resetPlaybackTelemetry(): void {
    this.firstPlayLogged = false
    this.playbackMilestones.clear()
  }

  /**
   * 标记音频已 primed
   */
  markAudioPrimed(): void {
    this.audioPrimed = true
  }

  /**
   * 标记踏板已使用（telemetry once）
   */
  markPedalUsed(): void {
    this.firstPedalLogged = true
  }

  /**
   * 标记首次播放（telemetry once）
   */
  markFirstPlay(): void {
    this.firstPlayLogged = true
  }

  /**
   * 添加播放里程碑（telemetry）
   */
  addPlaybackMilestone(seconds: number): void {
    this.playbackMilestones.add(seconds)
  }

  /**
   * 检查是否已达到播放里程碑
   */
  hasPlaybackMilestone(seconds: number): boolean {
    return this.playbackMilestones.has(seconds)
  }
}
