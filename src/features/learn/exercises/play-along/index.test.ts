import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseContext } from '@/features/learn/core/ExerciseContext'
import { createLearnState } from '@/features/learn/core/LearnState'

vi.mock('tone', () => ({
  getContext: () => ({ lookAhead: 0 }),
}))

const { engineInstances } = vi.hoisted(() => ({
  engineInstances: [] as Array<{
    togglePlay: ReturnType<typeof vi.fn>
    opts: { onSegmentComplete?: (target: 'song-end' | 'loop-end') => void }
    state: {
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
    readonly setHand = vi.fn()
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
        setPracticeHints: vi.fn(),
      } as never,
      input: null as never,
    },
    learnState: createLearnState(),
    progress: null as never,
    overlay: {
      drawLoopBand: vi.fn(),
      pulseTargetZone: vi.fn(),
      celebrationSwell: vi.fn(),
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
})
