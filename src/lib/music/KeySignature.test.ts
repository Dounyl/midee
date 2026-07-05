import { describe, expect, it } from 'vitest'
import { transposeDeltaToTonic } from './KeySignature'

describe('transposeDeltaToTonic', () => {
  it('returns the closest signed offset needed to reach C', () => {
    expect(
      transposeDeltaToTonic({ tonic: 'D', mode: 'major', source: 'midi', confidence: 1 }, 'C'),
    ).toBe(-2)
    expect(
      transposeDeltaToTonic({ tonic: 'G', mode: 'major', source: 'midi', confidence: 1 }, 'C'),
    ).toBe(5)
    expect(
      transposeDeltaToTonic({ tonic: 'F#', mode: 'major', source: 'midi', confidence: 1 }, 'C'),
    ).toBe(6)
  })

  it('supports flat tonics and preserves minor-key tonic math', () => {
    expect(
      transposeDeltaToTonic({ tonic: 'Bb', mode: 'major', source: 'midi', confidence: 1 }, 'C'),
    ).toBe(2)
    expect(
      transposeDeltaToTonic({ tonic: 'A', mode: 'minor', source: 'midi', confidence: 1 }, 'C'),
    ).toBe(3)
  })
})
