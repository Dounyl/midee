import { describe, expect, it } from 'vitest'
import {
  pitchClassToJianpuLabel,
  pitchToKeyboardLabels,
  pitchToJianpuLabel,
  shouldRenderKeyboardJianpuLabels,
  tonicPitchClassForKeySignature,
} from './jianpu'

describe('jianpu labels', () => {
  it('maps pitch classes to fixed-do labels by default', () => {
    expect(
      Array.from({ length: 12 }, (_, pitchClass) => pitchClassToJianpuLabel(pitchClass)),
    ).toEqual(['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7'])
  })

  it('wraps out-of-range pitch classes and midi pitches', () => {
    expect(pitchClassToJianpuLabel(-1)).toBe('7')
    expect(pitchToJianpuLabel(60)).toBe('1')
    expect(pitchToJianpuLabel(61)).toBe('#1')
    expect(pitchToJianpuLabel(71)).toBe('7')
  })

  it('resolves tonic pitch classes from supported key signatures', () => {
    expect(tonicPitchClassForKeySignature('C')).toBe(0)
    expect(tonicPitchClassForKeySignature('G')).toBe(7)
    expect(tonicPitchClassForKeySignature('Bb')).toBe(10)
    expect(tonicPitchClassForKeySignature('F#m')).toBe(6)
    expect(tonicPitchClassForKeySignature('')).toBe(0)
  })

  it('maps labels relative to the current key signature tonic', () => {
    expect(pitchToJianpuLabel(67, 'G')).toBe('1')
    expect(pitchToJianpuLabel(69, 'G')).toBe('2')
    expect(pitchToJianpuLabel(66, 'G')).toBe('7')
    expect(pitchToJianpuLabel(70, 'F')).toBe('4')
    expect(pitchToJianpuLabel(65, 'Dm')).toBe('#2')
  })

  it('accepts MidiKeySignature objects directly', () => {
    expect(
      pitchToJianpuLabel(66, { tonic: 'G', mode: 'major', source: 'midi', confidence: 1 }),
    ).toBe('7')
  })

  it('builds keyboard labels from the current scale and hides non-scale semitones', () => {
    expect(pitchToKeyboardLabels(60, 'C')).toEqual({ jianpu: '1', noteName: 'c' })
    expect(pitchToKeyboardLabels(64, 'C')).toEqual({ jianpu: '3', noteName: 'e' })
    expect(pitchToKeyboardLabels(61, 'C')).toBeNull()
    expect(pitchToKeyboardLabels(66, 'G')).toEqual({ jianpu: '7', noteName: 'f' })
    expect(pitchToKeyboardLabels(65, 'G')).toBeNull()
    expect(pitchToKeyboardLabels(70, 'F')).toEqual({ jianpu: '4', noteName: 'b' })
    expect(pitchToKeyboardLabels(63, 'Dm')).toBeNull()
    expect(pitchToKeyboardLabels(60, 'Dm')).toEqual({ jianpu: '7', noteName: 'c' })
  })

  it('renders keyboard labels for default and transposed keys', () => {
    expect(shouldRenderKeyboardJianpuLabels(null)).toBe(true)
    expect(shouldRenderKeyboardJianpuLabels('C')).toBe(true)
    expect(
      shouldRenderKeyboardJianpuLabels({
        tonic: 'A',
        mode: 'minor',
        source: 'midi',
        confidence: 1,
      }),
    ).toBe(true)
    expect(shouldRenderKeyboardJianpuLabels('G')).toBe(true)
    expect(
      shouldRenderKeyboardJianpuLabels({
        tonic: 'F#',
        mode: 'minor',
        source: 'midi',
        confidence: 1,
      }),
    ).toBe(false)
  })
})
