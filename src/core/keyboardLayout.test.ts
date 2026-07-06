import { describe, expect, it } from 'vitest'
import {
  getCompatibleTranspositions,
  getKeyboardHeightProfile,
  getKeyboardRange,
  getMidiPitchSpan,
  midiFitsKeyboardMode,
  shouldPromptKeyboardModeSuggestion,
} from './keyboardLayout'
import type { MidiFile } from './midi/types'

function makeMidi(pitches: number[]): MidiFile {
  return {
    name: 'test',
    duration: 1,
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        channel: 0,
        instrument: 0,
        isDrum: false,
        color: 0xffffff,
        colorIndex: 0,
        notes: pitches.map((pitch, i) => ({
          pitch,
          time: i,
          duration: 0.5,
          velocity: 0.8,
        })),
      },
    ],
  }
}

describe('keyboardLayout', () => {
  it('returns the expected ranges', () => {
    expect(getKeyboardRange('61')).toEqual({ min: 36, max: 96 })
    expect(getKeyboardRange('88')).toEqual({ min: 21, max: 108 })
  })

  it('gives 61-key mode a taller height profile', () => {
    expect(getKeyboardHeightProfile('61').desktop).toBeGreaterThan(
      getKeyboardHeightProfile('88').desktop,
    )
    expect(getKeyboardHeightProfile('61').portraitRatio).toBeGreaterThan(
      getKeyboardHeightProfile('88').portraitRatio,
    )
    expect(getKeyboardHeightProfile('61').blackKeyHeightRatio).toBeGreaterThan(
      getKeyboardHeightProfile('88').blackKeyHeightRatio,
    )
  })

  it('computes midi pitch span across notes', () => {
    expect(getMidiPitchSpan(makeMidi([40, 72, 55]))).toEqual({ min: 40, max: 72 })
  })

  it('treats empty midi as fitting', () => {
    expect(
      midiFitsKeyboardMode(
        {
          name: 'empty',
          duration: 0,
          bpm: 120,
          timeSignature: [4, 4],
          tracks: [
            {
              id: 't1',
              name: 'Track 1',
              channel: 0,
              instrument: 0,
              isDrum: false,
              color: 0xffffff,
              colorIndex: 0,
              notes: [],
            },
          ],
        },
        '61',
      ),
    ).toBe(true)
  })

  it('detects when midi exceeds 61-key range', () => {
    expect(midiFitsKeyboardMode(makeMidi([36, 60, 96]), '61')).toBe(true)
    expect(midiFitsKeyboardMode(makeMidi([35, 60, 96]), '61')).toBe(false)
    expect(midiFitsKeyboardMode(makeMidi([36, 60, 97]), '61')).toBe(false)
  })

  it('offers compatible transpositions for 61-key mode', () => {
    const suggestions = getCompatibleTranspositions(makeMidi([35, 60, 95]), '61')
    expect(suggestions.some((opt) => opt.semitones === 1)).toBe(true)
    expect(suggestions.some((opt) => opt.semitones === 0)).toBe(false)
  })

  it('only prompts for 61-key mode when the midi does not fit', () => {
    expect(shouldPromptKeyboardModeSuggestion(makeMidi([36, 60, 96]), '61')).toBe(false)
    expect(shouldPromptKeyboardModeSuggestion(makeMidi([35, 60, 96]), '61')).toBe(true)
    expect(shouldPromptKeyboardModeSuggestion(makeMidi([35, 60, 96]), '88')).toBe(false)
  })

  it('returns no compatible transpositions when a midi cannot fit 61 keys at all', () => {
    expect(getCompatibleTranspositions(makeMidi([20, 60, 110]), '61')).toEqual([])
  })
})
