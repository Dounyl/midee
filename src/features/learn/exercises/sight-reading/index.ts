import { batch } from 'solid-js'
import type { Exercise } from '@/features/learn/core/Exercise'
import type { ExerciseContext } from '@/features/learn/core/ExerciseContext'
import { defineExerciseDescriptor } from '@/features/learn/core/exerciseDescriptor'
import { isKeyboardShortcutIgnored } from '@/features/learn/core/keyboard'
import type { ExerciseResult } from '@/features/learn/core/Result'
import { computeXp } from '@/features/learn/core/scoring'
import type { BusNoteEvent } from '@/services/input/InputBus'
import { SightReadingEngine } from './engine'
import { generateNoteSource, TIER_CONFIGS } from './generator'
import { sightReadingMeta } from './meta'
import { SightReadLayer } from './renderer'
import type { ClefMode, TierConfig, TierKey } from './types'
import { createSightReadHud } from './ui'

export function poolForClef(clef: ClefMode, tier: TierConfig): number[] {
  if (clef === 'treble') return [...tier.pitchPool].sort((a, b) => a - b)

  if (clef === 'bass') {
    const bassNotes = tier.pitchPool.map((p) => (p >= 60 ? p - 12 : p))
    return [...new Set(bassNotes)].sort((a, b) => a - b)
  }

  const pool = new Set(tier.pitchPool)
  for (const p of tier.pitchPool) {
    if (p >= 60) pool.add(p - 12)
  }
  return [...pool].sort((a, b) => a - b)
}

export const sightReadingDescriptor = defineExerciseDescriptor({
  ...sightReadingMeta,
  factory: (ctx) => new SightReadingExercise(ctx, 'landmark'),
})

class SightReadingExercise implements Exercise {
  readonly descriptor = sightReadingDescriptor

  private engine: SightReadingEngine
  private staffLayer: SightReadLayer
  private hud: ReturnType<typeof createSightReadHud>
  private tierKey: TierKey
  private onEscKey: ((e: KeyboardEvent) => void) | null = null

  constructor(
    private ctx: ExerciseContext,
    tierKey: TierKey,
  ) {
    this.tierKey = tierKey
    const tier = TIER_CONFIGS[tierKey]

    this.engine = new SightReadingEngine({
      bpm: tier.defaultBpm,
      bpmRamp: tierKey === 'arcade' ? 0.5 : 0,
      maxBpm: 160,
      lookAheadBeats: 4,
      practiceMode: tierKey !== 'arcade',
    })

    this.staffLayer = new SightReadLayer(this.engine, {
      clef: tier.clef,
      keySignature: tier.keySignature,
      showLabels: false,
    })

    this.hud = createSightReadHud()
  }

  mount(host: HTMLElement): void {
    const tier = TIER_CONFIGS[this.tierKey]

    this.ctx.services.renderer.clearMidi()
    this.ctx.services.renderer.addLayer(this.staffLayer)

    this.hud.mount(host, {
      engine: this.engine,
      tier,
      onPlayAgain: () => this.restart(),
      onPracticeWeak: (pitches) => this.restart(pitches),
      onClose: () => this.ctx.onClose('abandoned'),
      onRestart: () => this.restart(),
      onClefChange: (clef) => {
        this.staffLayer.setClef(clef)
        this.staffLayer.resetDone()
        this.staffLayer.activeKeys.clear()
        const pool = poolForClef(clef, tier)
        batch(() => {
          this.engine.attach(
            generateNoteSource({ pitchPool: pool, sessionLength: tier.sessionLength }),
          )
          this.engine.start()
        })
      },
    })
  }

  start(): void {
    const tier = TIER_CONFIGS[this.tierKey]

    this.ctx.services.synth.primeLiveInput()
    this.engine.attach(
      generateNoteSource({
        pitchPool: poolForClef(tier.clef, tier),
        sessionLength: tier.sessionLength,
      }),
    )
    this.engine.start()

    this.onEscKey = (e: KeyboardEvent) => {
      if (isKeyboardShortcutIgnored(e)) return
      if (e.code === 'Escape') {
        e.preventDefault()
        if (this.engine.paused) this.engine.resume()
        else this.engine.pause()
      } else if (this.engine.paused) {
        if (e.code === 'BracketLeft') {
          e.preventDefault()
          this.engine.setBpm(this.engine.bpm - 5)
        } else if (e.code === 'BracketRight') {
          e.preventDefault()
          this.engine.setBpm(this.engine.bpm + 5)
        }
      }
    }
    window.addEventListener('keydown', this.onEscKey)
  }

  stop(): void {
    if (this.onEscKey) {
      window.removeEventListener('keydown', this.onEscKey)
      this.onEscKey = null
    }
    this.engine.stop()
  }

  unmount(): void {
    this.ctx.services.renderer.removeLayer(this.staffLayer)
    this.hud.unmount()
  }

  onNoteOn(evt: BusNoteEvent): void {
    const result = this.engine.noteOn(evt.pitch)

    if (result === 'hit') {
      this.ctx.services.synth.liveNoteOn(evt.pitch, 0.8)
      setTimeout(() => this.ctx.services.synth.liveNoteOff(evt.pitch), 400)
      this.ctx.log.hit(evt.pitch)
    } else if (result === 'wrong') {
      this.ctx.log.miss(evt.pitch)
    }

    this.staffLayer.activeKeys.add(evt.pitch)
  }

  onNoteOff(evt: BusNoteEvent): void {
    this.staffLayer.activeKeys.delete(evt.pitch)
  }

  result(): ExerciseResult | null {
    const { totalPlayed, phase } = this.engine.state
    if (totalPlayed < 3) return null
    const acc = this.engine.hitAccuracy
    if (acc === null) return null
    return {
      exerciseId: sightReadingDescriptor.id,
      duration_s: 0,
      accuracy: acc,
      xp: computeXp({ accuracy: acc, duration_s: 60, difficultyWeight: 1.0 }),
      weakSpots: this.engine.weakSpots,
      completed: phase === 'complete',
    }
  }

  private restart(focusPitches?: number[]): void {
    const tier = TIER_CONFIGS[this.tierKey]
    const clef = this.staffLayer.currentClef()
    const pool = poolForClef(clef, tier)
    this.staffLayer.resetDone()
    this.staffLayer.activeKeys.clear()
    batch(() => {
      this.engine.attach(
        generateNoteSource({
          pitchPool: pool,
          sessionLength: tier.sessionLength,
          ...(focusPitches && { weakNoteFocus: focusPitches }),
        }),
      )
      this.engine.start()
    })
  }
}
