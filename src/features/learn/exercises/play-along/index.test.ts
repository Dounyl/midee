import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseContext } from '@/features/learn/core/ExerciseContext'
import { createLearnState } from '@/features/learn/core/LearnState'

vi.mock('tone', () => ({
  getContext: () => ({ lookAhead: 0 }),
}))

const { engineInstances } = vi.hoisted(() => ({
  engineInstances: [] as Array<{
    togglePlay: ReturnType<typeof vi.fn>
    onNoteOn: ReturnType<typeof vi.fn>
    opts: { onSegmentComplete?: (target: 'song-end' | 'loop-end') => void }
    state: {
      guidedMode: string
      perfect: number
      good: number
      errors: number
      heldTicks: number
      cleanPasses: number
      loopRegion: { start: number; end: number } | null
    }
  }>,
}))

vi.mock('./engine', () => ({
  DEFAULT_SPEED_PRESETS: [60, 80, 100],
  PlayAlongEngine: class {
    readonly services
    readonly state = {
      loopRegion: null,
      loopMark: null,
      waitEnabled: true,
      speedPct: 100,
      hand: 'both',
      guidedMode: 'demo',
      tempoRampEnabled: false,
      cleanPasses: 0,
      perfect: 0,
      good: 0,
      errors: 0,
      heldTicks: 0,
      streak: 0,
      userWantsToPlay: true,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    }
    readonly practice = {
      isWaiting: false,
      status: {
        subscribe: vi.fn(() => () => {}),
        value: { enabled: true, waiting: false, pending: [], accepted: [] },
      },
    }
    readonly togglePlay = vi.fn()
    readonly attach = vi.fn()
    readonly detach = vi.fn()
    readonly play = vi.fn()
    readonly pause = vi.fn()
    readonly seek = vi.fn()
    readonly setWaitEnabled = vi.fn()
    readonly setTempoRamp = vi.fn()
    readonly setHand = vi.fn((hand: 'left' | 'right' | 'both') => {
      this.state.hand = hand
    })
    readonly setGuidedMode = vi.fn((mode: 'demo' | 'practice') => {
      this.state.guidedMode = mode
    })
    readonly markLoopPoint = vi.fn()
    readonly clearLoop = vi.fn()
    readonly setSpeedPreset = vi.fn()
    readonly setLoopRegion = vi.fn()
    readonly onNoteOn = vi.fn(() => 'none')
    readonly onNoteOff = vi.fn()
    readonly replaceMidi = vi.fn()

    readonly opts

    constructor(opts: {
      services: unknown
      onSegmentComplete?: (target: 'song-end' | 'loop-end') => void
    }) {
      this.services = opts.services
      this.opts = opts
      engineInstances.push(this)
    }
  },
}))

vi.mock('./hud', () => ({
  createPlayAlongHud: () => ({
    mount: vi.fn(),
    unmount: vi.fn(),
  }),
}))

import { playAlongDescriptor } from './index'

function makeContext(): ExerciseContext {
  return {
    descriptor: playAlongDescriptor,
    services: {
      store: null as never,
      clock: { currentTime: 0 } as never,
      synth: null as never,
      metronome: null as never,
      renderer: {
        currentTheme: { nowLine: 0xfbd38d },
        currentViewport: { config: { canvasWidth: 960 }, nowLineY: 180 },
        setPracticeHints: vi.fn(),
        setParticleEffectsSuppressed: vi.fn(),
        burstParticleAt: vi.fn(),
      } as never,
      input: null as never,
    },
    learnState: createLearnState(),
    progress: null as never,
    overlay: {
      drawLoopBand: vi.fn(),
      pulseTargetZone: vi.fn(),
      celebrationSwell: vi.fn(),
      practiceSuccessBurst: vi.fn(),
      update: vi.fn(),
    } as never,
    host: document.createElement('div'),
    onClose: vi.fn(),
    log: {
      hit: vi.fn(),
      miss: vi.fn(),
      error: vi.fn(),
      event: vi.fn(),
    },
    storage: {
      get: <T>(_key: string, fallback: T) => fallback,
      set: vi.fn(),
    },
  }
}

describe('PlayAlongExercise keyboard shortcuts', () => {
  beforeEach(() => {
    engineInstances.length = 0
    document.body.innerHTML = ''
  })

  it('toggles playback with Space even when a range input has focus', () => {
    const exercise = playAlongDescriptor.factory(makeContext())
    exercise.start()

    const engine = engineInstances[0]
    expect(engine).toBeDefined()

    const scrubber = document.createElement('input')
    scrubber.type = 'range'
    document.body.append(scrubber)

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })

    scrubber.dispatchEvent(event)

    expect(engine?.togglePlay).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)

    exercise.stop()
  })

  it('returns a play-along summary for song-end completion even with zero attempts', async () => {
    const ctx = makeContext()
    const exercise = playAlongDescriptor.factory(ctx)
    exercise.start()

    const engine = engineInstances[0]
    expect(engine).toBeDefined()

    engine?.opts.onSegmentComplete?.('song-end')
    await Promise.resolve()

    const result = exercise.result()
    expect(result).toMatchObject({
      exerciseId: 'play-along',
      accuracy: 0,
      xp: 0,
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'song-end',
        perfect: 0,
        good: 0,
        errors: 0,
        heldTicks: 0,
        cleanPasses: 0,
        loopRegion: null,
      },
    })

    exercise.stop()
  })

  it('fires enlarged success feedback only for accepted notes in practice mode', () => {
    const ctx = makeContext()
    ctx.learnState.setState('loadedMidi', {
      name: 'practice.mid',
      duration: 30,
      bpm: 120,
      timeSignature: [4, 4],
      keySignature: null,
      tracks: [
        {
          id: 'rh',
          name: 'Right',
          channel: 0,
          instrument: 0,
          isDrum: false,
          color: 0xffffff,
          colorIndex: 0,
          notes: [{ pitch: 60, time: 2, duration: 1, velocity: 1 }],
        },
      ],
    } as never)
    ;(ctx.services.clock as { currentTime: number }).currentTime = 2.2
    const exercise = playAlongDescriptor.factory(ctx)
    exercise.start()

    const engine = engineInstances[0]
    expect(engine).toBeDefined()

    engine!.state.guidedMode = 'practice'
    engine!.onNoteOn.mockReturnValueOnce('accepted')

    exercise.onNoteOn?.({ pitch: 59, velocity: 1, clockTime: 2.2, source: 'midi' })

    expect(ctx.overlay.pulseTargetZone).not.toHaveBeenCalled()
    expect(ctx.services.renderer.burstParticleAt).not.toHaveBeenCalled()
    expect(ctx.overlay.practiceSuccessBurst).not.toHaveBeenCalled()

    engine!.onNoteOn.mockReturnValueOnce('advanced')

    exercise.onNoteOn?.({ pitch: 60, velocity: 1, clockTime: 2.2, source: 'midi' })

    expect(ctx.log.hit).toHaveBeenCalledWith(60)
    expect(ctx.overlay.pulseTargetZone).toHaveBeenCalled()
    expect(ctx.services.renderer.burstParticleAt).toHaveBeenCalledWith(60, { force: true })
    expect(ctx.overlay.practiceSuccessBurst).toHaveBeenCalled()

    ;(ctx.overlay.pulseTargetZone as ReturnType<typeof vi.fn>).mockClear()
    ;(ctx.overlay.practiceSuccessBurst as ReturnType<typeof vi.fn>).mockClear()
    ;(ctx.services.renderer.burstParticleAt as ReturnType<typeof vi.fn>).mockClear()
    ;(ctx.log.error as ReturnType<typeof vi.fn>).mockClear()

    engine!.onNoteOn.mockReturnValueOnce('rejected')
    exercise.onNoteOn?.({ pitch: 61, velocity: 1, clockTime: 0, source: 'midi' })

    expect(ctx.log.error).toHaveBeenCalled()
    expect(ctx.overlay.pulseTargetZone).not.toHaveBeenCalled()
    expect(ctx.services.renderer.burstParticleAt).not.toHaveBeenCalled()
    expect(ctx.overlay.practiceSuccessBurst).not.toHaveBeenCalled()

    exercise.stop()
  })

  it('suppresses particles only while guided practice mode is active', () => {
    const ctx = makeContext()
    const exercise = playAlongDescriptor.factory(ctx)
    exercise.start()

    const engine = engineInstances[0]
    expect(engine).toBeDefined()

    expect(ctx.services.renderer.setParticleEffectsSuppressed).toHaveBeenCalledWith(false)

    engine!.state.guidedMode = 'practice'
    ;(exercise as unknown as { syncGuidedModePresentation: () => void }).syncGuidedModePresentation()

    expect(ctx.services.renderer.setParticleEffectsSuppressed).toHaveBeenLastCalledWith(true)

    exercise.stop()

    expect(ctx.services.renderer.setParticleEffectsSuppressed).toHaveBeenLastCalledWith(false)
  })
})
