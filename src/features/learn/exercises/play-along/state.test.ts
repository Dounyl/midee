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
    })
  })

  it('round-trips persisted preferences', () => {
    writePlayAlongPreferences({
      waitEnabled: false,
      tempoRampEnabled: true,
      speedPct: 80,
      hand: 'left',
    })

    expect(readPlayAlongPreferences()).toEqual({
      waitEnabled: false,
      tempoRampEnabled: true,
      speedPct: 80,
      hand: 'left',
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
