import { getContext } from 'tone'
import type { Exercise } from '@/features/learn/core/Exercise'
import type { ExerciseContext } from '@/features/learn/core/ExerciseContext'
import { defineExerciseDescriptor } from '@/features/learn/core/exerciseDescriptor'
import { createExerciseHarness } from '@/features/learn/core/exerciseHarness'
import { isKeyboardShortcutIgnored } from '@/features/learn/core/keyboard'
import type { ExerciseResult } from '@/features/learn/core/Result'
import { performanceResult } from '@/features/learn/core/resultHelpers'
import type { LoopRegion } from '@/features/learn/engines/LoopRegion'
import type { BusNoteEvent } from '@/services/input/InputBus'
import { watch } from '@/stores/app/watch'
import type { MidiFile } from '@/types/midi/types'
import { DEFAULT_SPEED_PRESETS, PlayAlongEngine } from './engine'
import { createPlayAlongHud, type PlayAlongHudOptions } from './hud'
import { playAlongMeta } from './meta'
import {
  consumePlayAlongReplayState,
  readPlayAlongPreferences,
  writePlayAlongPreferences,
} from './state'
import { wireScoreDragSeek } from './wireScoreDragSeek'

const PLAY_ALONG_LOOK_AHEAD_SEC = 0.005

export const playAlongDescriptor = defineExerciseDescriptor({
  ...playAlongMeta,
  factory: (ctx) => new PlayAlongExercise(ctx),
})

class PlayAlongExercise implements Exercise {
  readonly descriptor = playAlongDescriptor
  private engine: PlayAlongEngine
  private hud: ReturnType<typeof createPlayAlongHud>
  private readonly hudOpts: PlayAlongHudOptions
  private harness: ReturnType<typeof createExerciseHarness>
  private prevLookAhead: number | null = null
  private detachScoreDrag: (() => void) | null = null
  private unsubs: Array<() => void> = []
  private completionRequested = false
  private completionTarget: 'song-end' | 'loop-end' | null = null
  private completionLoopRegion: LoopRegion | null = null
  private readonly initialPrefs = readPlayAlongPreferences()
  private readonly replayState = consumePlayAlongReplayState()

  constructor(private ctx: ExerciseContext) {
    this.engine = new PlayAlongEngine({
      services: ctx.services,
      learnState: ctx.learnState,
      onCleanPass: () => this.onCleanPass(),
      onSegmentComplete: (target) => this.requestCompletion(target),
    })
    this.hud = createPlayAlongHud()
    this.hudOpts = {
      engine: this.engine,
      onMarkLoop: () => this.markLoop(),
      onClearLoop: () => this.clearLoop(),
    }
    this.harness = createExerciseHarness({
      hud: this.hud,
      hudOpts: this.hudOpts,
      onKeyDown: this.onKeyDown,
    })
  }

  mount(host: HTMLElement): void {
    this.harness.mountHud(host)
    const midi = this.ctx.learnState.state.loadedMidi
    if (midi) {
      this.ctx.services.renderer.loadMidi(midi)
    }
    this.ctx.overlay.pulseTargetZone(this.ctx.services.renderer.currentTheme.nowLine)
  }

  start(): void {
    try {
      const ctx = getContext()
      this.prevLookAhead = ctx.lookAhead
      ctx.lookAhead = PLAY_ALONG_LOOK_AHEAD_SEC
    } catch {
      this.prevLookAhead = null
    }
    const midi = this.ctx.learnState.state.loadedMidi
    this.engine.attach(midi)
    this.restorePreferences()
    this.restoreReplayState()
    this.detachScoreDrag?.()
    this.detachScoreDrag = wireScoreDragSeek({
      canvas: this.ctx.services.renderer.canvas,
      getPixelsPerSecond: () => this.ctx.services.renderer.currentViewport.config.pixelsPerSecond,
      getRollHeight: () => this.ctx.services.renderer.currentViewport.rollHeight,
      getNowLineY: () => this.ctx.services.renderer.currentViewport.nowLineY,
      getCurrentTime: () => this.ctx.services.clock.currentTime,
      canSeekFromScoreDrag: () =>
        this.ctx.learnState.state.status === 'paused' && !this.engine.state.userWantsToPlay,
      seek: (time) => this.engine.seek(time),
    })
    this.renderLoopBand(this.engine.state.loopRegion)
    this.unsubs.push(
      watch(
        () => this.engine.state.guidedMode,
        () => this.syncGuidedModePresentation(),
      ),
      watch(
        () => this.engine.state.loopRegion,
        (region) => this.renderLoopBand(region),
      ),
      watch(
        () =>
          [
            this.engine.state.waitEnabled,
            this.engine.state.tempoRampEnabled,
            this.engine.state.speedPct,
            this.engine.state.hand,
            this.engine.state.guidedMode,
          ] as const,
        () =>
          writePlayAlongPreferences({
            waitEnabled: this.engine.state.waitEnabled,
            tempoRampEnabled: this.engine.state.tempoRampEnabled,
            speedPct: this.engine.state.speedPct,
            hand: this.engine.state.hand,
            guidedMode: this.engine.state.guidedMode,
          }),
      ),
      this.engine.practice.status.subscribe((status) => {
        if (!status.waiting) {
          this.ctx.services.renderer.setPracticeHints(null, null)
          return
        }
        this.ctx.services.renderer.setPracticeHints(status.pending, status.accepted)
      }),
    )
    this.syncGuidedModePresentation()
    if (this.replayState?.autoplay !== false) {
      this.engine.play()
    }
    this.harness.attachKeys()
  }

  stop(): void {
    this.harness.detachKeys()
    this.detachScoreDrag?.()
    this.detachScoreDrag = null
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.ctx.services.renderer.setPracticeHints(null, null)
    this.ctx.services.renderer.setParticleEffectsSuppressed(false)
    this.engine.detach()
    this.completionRequested = false
    if (this.prevLookAhead !== null) {
      try {
        getContext().lookAhead = this.prevLookAhead
      } catch {}
      this.prevLookAhead = null
    }
  }

  unmount(): void {
    this.harness.unmountHud()
    this.ctx.overlay.drawLoopBand(null)
    this.ctx.services.renderer.setPracticeHints(null, null)
  }

  onNoteOn(evt: BusNoteEvent): void {
    const kind = this.engine.onNoteOn(evt)
    if (kind === 'advanced') {
      this.ctx.log.hit(evt.pitch)
      if (this.shouldRenderPracticeFeedback(evt.pitch)) this.emitPracticeSuccessFeedback(evt.pitch)
    } else if (kind === 'accepted') {
      if (this.shouldRenderPracticeFeedback(evt.pitch)) this.emitPracticeSuccessFeedback(evt.pitch)
    } else if (kind === 'rejected') {
      this.ctx.log.error()
    }
  }

  onNoteOff(evt: BusNoteEvent): void {
    this.engine.onNoteOff(evt)
  }

  onMidiReplaced(midi: MidiFile): void {
    this.ctx.services.renderer.loadMidi(midi)
    this.engine.replaceMidi(midi)
  }

  result(): ExerciseResult | null {
    const attempts = this.engine.state.perfect + this.engine.state.good + this.engine.state.errors
    const result =
      this.completionTarget && attempts === 0
        ? ({
            exerciseId: this.descriptor.id,
            duration_s: 0,
            accuracy: 0,
            xp: 0,
            weakSpots: [],
            completed: true,
          } satisfies ExerciseResult)
        : performanceResult({
            exerciseId: this.descriptor.id,
            perfect: this.engine.state.perfect,
            good: this.engine.state.good,
            errors: this.engine.state.errors,
            difficultyWeight: 1,
            completed: true,
          })
    if (!result) return null
    if (this.completionTarget) {
      result.summary = {
        kind: 'play-along',
        completionTarget: this.completionTarget,
        perfect: this.engine.state.perfect,
        good: this.engine.state.good,
        errors: this.engine.state.errors,
        heldTicks: this.engine.state.heldTicks,
        cleanPasses: this.engine.state.cleanPasses,
        loopRegion: this.completionLoopRegion,
      }
    }
    return result
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      if (e.repeat || e.shiftKey || isKeyboardShortcutIgnored(e)) return
      e.preventDefault()
      this.engine.togglePlay()
      return
    }
    if (e.shiftKey || isKeyboardShortcutIgnored(e)) return
    if (e.code === 'KeyL') {
      e.preventDefault()
      this.markLoop()
    } else if (e.code === 'BracketLeft') {
      e.preventDefault()
      this.stepSpeed(-1)
    } else if (e.code === 'BracketRight') {
      e.preventDefault()
      this.stepSpeed(1)
    }
  }

  private markLoop(): void {
    if (!this.ctx.learnState.state.loadedMidi) return
    this.engine.markLoopPoint(this.ctx.services.clock.currentTime)
  }

  private clearLoop(): void {
    this.engine.clearLoop()
  }

  private stepSpeed(delta: number): void {
    const idx = (DEFAULT_SPEED_PRESETS as readonly number[]).indexOf(this.engine.state.speedPct)
    const next = idx >= 0 ? DEFAULT_SPEED_PRESETS[idx + delta] : undefined
    if (next !== undefined) this.engine.setSpeedPreset(next)
  }

  private onCleanPass(): void {
    const viewport = this.ctx.services.renderer.currentViewport
    this.ctx.overlay.celebrationSwell(viewport.config.canvasWidth / 2, viewport.nowLineY, 0xfbd38d)
  }

  private restorePreferences(): void {
    this.engine.setWaitEnabled(this.initialPrefs.waitEnabled)
    this.engine.setTempoRamp(this.initialPrefs.tempoRampEnabled)
    this.engine.setHand(this.initialPrefs.hand)
    this.engine.setGuidedMode(this.initialPrefs.guidedMode)
    this.engine.setSpeedPreset(this.initialPrefs.speedPct)
  }

  private emitPracticeSuccessFeedback(pitch: number): void {
    if (this.engine.state.guidedMode !== 'practice') return
    const viewport = this.ctx.services.renderer.currentViewport
    const color = 0xfbd38d
    this.ctx.overlay.pulseTargetZone(color)
    this.ctx.services.renderer.burstParticleAt(pitch, { force: true })
    this.ctx.overlay.practiceSuccessBurst(viewport.config.canvasWidth / 2, viewport.nowLineY, color)
  }

  private shouldRenderPracticeFeedback(pitch: number): boolean {
    if (this.engine.state.guidedMode !== 'practice') return false
    const midi = this.ctx.learnState.state.loadedMidi
    if (!midi) return false
    const currentTime = this.ctx.services.clock.currentTime
    const practiceTrackIds = resolvePracticeTrackIdsForFeedback(midi, this.engine.state.hand)
    for (const track of midi.tracks) {
      if (track.isDrum) continue
      if (practiceTrackIds !== null && !practiceTrackIds.has(track.id)) continue
      for (const note of track.notes) {
        if (note.pitch !== pitch) continue
        if (note.time <= currentTime && currentTime <= note.time + note.duration) return true
      }
    }
    return false
  }

  private syncGuidedModePresentation(): void {
    this.ctx.services.renderer.setParticleEffectsSuppressed(
      this.engine.state.guidedMode === 'practice',
    )
  }

  private restoreReplayState(): void {
    if (!this.replayState) return
    this.engine.setLoopRegion(this.replayState.loopRegion)
    this.engine.seek(this.replayState.startTime)
  }

  private renderLoopBand(region: LoopRegion | null): void {
    if (!region) {
      this.ctx.overlay.drawLoopBand(null)
      return
    }
    this.ctx.overlay.drawLoopBand({
      startTime: region.start,
      endTime: region.end,
      color: 0xf3c36c,
    })
  }

  private requestCompletion(target: 'song-end' | 'loop-end'): void {
    if (this.completionRequested) return
    this.completionRequested = true
    this.completionTarget = target
    this.completionLoopRegion = target === 'loop-end' ? this.engine.state.loopRegion : null
    queueMicrotask(() => this.ctx.onClose('completed'))
  }
}

function resolvePracticeTrackIdsForFeedback(
  midi: MidiFile,
  hand: 'left' | 'right' | 'both',
): ReadonlySet<string> | null {
  if (hand === 'both') return null
  const ids = midi.tracks
    .filter((track) => {
      if (track.isDrum || track.notes.length === 0) return false
      let sum = 0
      for (const note of track.notes) sum += note.pitch
      const avg = sum / track.notes.length
      return hand === 'left' ? avg < 60 : avg >= 60
    })
    .map((track) => track.id)
  return new Set(ids)
}
