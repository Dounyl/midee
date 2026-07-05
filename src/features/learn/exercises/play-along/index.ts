import { getContext } from 'tone'
import type { BusNoteEvent } from '../../../core/input/InputBus'
import type { MidiFile } from '../../../core/midi/types'
import { watch } from '../../../store/watch'
import type { Exercise } from '../../core/Exercise'
import type { ExerciseContext } from '../../core/ExerciseContext'
import { defineExerciseDescriptor } from '../../core/exerciseDescriptor'
import { createExerciseHarness } from '../../core/exerciseHarness'
import { isKeyboardShortcutIgnored } from '../../core/keyboard'
import type { ExerciseResult } from '../../core/Result'
import { performanceResult } from '../../core/resultHelpers'
import { DEFAULT_SPEED_PRESETS, PlayAlongEngine } from './engine'
import { createPlayAlongHud, type PlayAlongHudOptions } from './hud'
import { playAlongMeta } from './meta'

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
  private unsubs: Array<() => void> = []

  constructor(private ctx: ExerciseContext) {
    this.engine = new PlayAlongEngine({
      services: ctx.services,
      learnState: ctx.learnState,
      onCleanPass: () => this.onCleanPass(),
    })
    this.hud = createPlayAlongHud()
    this.hudOpts = {
      engine: this.engine,
      onCloseExercise: () => this.ctx.onClose('abandoned'),
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
    this.engine.setWaitEnabled(true)
    this.ctx.overlay.drawLoopBand(null)
    this.unsubs.push(
      watch(
        () => this.engine.state.loopRegion,
        (region) => {
          if (!region) {
            this.ctx.overlay.drawLoopBand(null)
          } else {
            this.ctx.overlay.drawLoopBand({
              startTime: region.start,
              endTime: region.end,
              color: 0xf3c36c,
            })
          }
        },
      ),
      this.engine.practice.status.subscribe((status) => {
        if (!status.waiting) {
          this.ctx.services.renderer.setPracticeHints(null, null)
          return
        }
        this.ctx.services.renderer.setPracticeHints(status.pending, status.accepted)
      }),
    )
    this.engine.play()
    this.harness.attachKeys()
  }

  stop(): void {
    this.harness.detachKeys()
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.ctx.services.renderer.setPracticeHints(null, null)
    this.engine.detach()
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
    } else if (kind === 'rejected') {
      this.ctx.log.error()
    }
    if (this.engine.practice.isWaiting === false) {
      this.ctx.overlay.pulseTargetZone(0xfbd38d)
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
    return performanceResult({
      exerciseId: this.descriptor.id,
      perfect: this.engine.state.perfect,
      good: this.engine.state.good,
      errors: this.engine.state.errors,
      difficultyWeight: 1,
      completed: true,
    })
  }

  private onKeyDown = (e: KeyboardEvent): void => {
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
}
