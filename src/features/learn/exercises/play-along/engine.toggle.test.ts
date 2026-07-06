import { describe, expect, it } from 'vitest'
import { createLearnState, type LearnState } from '@/features/learn/core/LearnState'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'
import { PlayAlongEngine } from './engine'

function makeClock() {
  const listeners = new Set<(t: number) => void>()
  let t = 0
  let speed = 1
  let playing = false
  return {
    get currentTime() {
      return t
    },
    set currentTime(v: number) {
      t = v
    },
    get playing() {
      return playing
    },
    get speed() {
      return speed
    },
    set speed(v: number) {
      speed = v
    },
    play() {
      playing = true
    },
    pause() {
      playing = false
    },
    seek(newT: number) {
      t = Math.max(0, newT)
    },
    subscribe(fn: (t: number) => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    emit(newT: number) {
      t = newT
      for (const fn of listeners) fn(newT)
    },
  }
}

function makeSynth() {
  return {
    setSpeed: () => {},
    seek: () => {},
  }
}

function makeRenderer() {
  return {
    setPracticeTrackFocus: () => {},
  }
}

function makeMidi(): MidiFile {
  return {
    name: 'toggle.mid',
    duration: 8,
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [
      {
        id: 'rh',
        name: 'Right',
        channel: 0,
        instrument: 0,
        isDrum: false,
        color: 0xffffff,
        colorIndex: 0,
        notes: [
          { pitch: 60, time: 2, duration: 0.5, velocity: 1 },
          { pitch: 64, time: 2, duration: 0.5, velocity: 1 },
        ],
      },
    ],
  }
}

function makeServices(): {
  services: AppServices
  clock: ReturnType<typeof makeClock>
  learnState: LearnState
} {
  const clock = makeClock()
  const learnState = createLearnState()
  return {
    clock,
    learnState,
    services: {
      store: null as never,
      clock: clock as unknown as AppServices['clock'],
      synth: makeSynth() as unknown as AppServices['synth'],
      metronome: null as never,
      renderer: makeRenderer() as unknown as AppServices['renderer'],
      input: null as never,
    },
  }
}

describe('PlayAlongEngine wait toggle', () => {
  it('disabling wait during an active wait resumes playback immediately', () => {
    const { services, clock, learnState } = makeServices()
    const engine = new PlayAlongEngine({ services, learnState })
    engine.attach(makeMidi())
    engine.setWaitEnabled(true)
    engine.play()

    clock.emit(2.01)
    expect(engine.practice.isWaiting).toBe(true)
    expect(clock.playing).toBe(false)
    expect(learnState.state.status).toBe('paused')

    engine.setWaitEnabled(false)

    expect(engine.practice.isEnabled).toBe(false)
    expect(engine.practice.isWaiting).toBe(false)
    expect(clock.playing).toBe(true)
    expect(learnState.state.status).toBe('playing')
  })
})
