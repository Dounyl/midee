import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumePlayAlongReplayState,
  readPlayAlongPreferences,
  stagePlayAlongReplayState,
  writePlayAlongPreferences,
} from './state'

describe('play-along persisted state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads defaults when nothing has been stored yet', () => {
    expect(readPlayAlongPreferences()).toEqual({
      waitEnabled: true,
      tempoRampEnabled: false,
      speedPct: 100,
      hand: 'both',
      guidedMode: 'demo',
    })
  })

  it('round-trips persisted preferences', () => {
    writePlayAlongPreferences({
      waitEnabled: false,
      tempoRampEnabled: true,
      speedPct: 80,
      hand: 'left',
      guidedMode: 'practice',
    })

    expect(readPlayAlongPreferences()).toEqual({
      waitEnabled: false,
      tempoRampEnabled: true,
      speedPct: 80,
      hand: 'left',
      guidedMode: 'practice',
    })
  })

  it('falls back to demo mode when old persisted state has no guided mode', () => {
    localStorage.setItem(
      'midee.learn.playAlong.state.v1',
      JSON.stringify({
        prefs: {
          waitEnabled: false,
          tempoRampEnabled: true,
          speedPct: 60,
          hand: 'right',
        },
      }),
    )

    expect(readPlayAlongPreferences()).toEqual({
      waitEnabled: false,
      tempoRampEnabled: true,
      speedPct: 60,
      hand: 'right',
      guidedMode: 'demo',
    })
  })

  it('consumes replay state exactly once', () => {
    stagePlayAlongReplayState({
      loopRegion: { start: 2, end: 6 },
      startTime: 2,
      autoplay: false,
    })

    expect(consumePlayAlongReplayState()).toEqual({
      loopRegion: { start: 2, end: 6 },
      startTime: 2,
      autoplay: false,
    })
    expect(consumePlayAlongReplayState()).toBeNull()
  })

  it('preserves replay state without a loop region', () => {
    stagePlayAlongReplayState({
      loopRegion: null,
      startTime: 0,
      autoplay: false,
    })

    expect(consumePlayAlongReplayState()).toEqual({
      loopRegion: null,
      startTime: 0,
      autoplay: false,
    })
  })
})
