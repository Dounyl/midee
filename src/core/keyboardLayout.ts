import type { MidiFile } from './midi/types'
import { keySignatureLabel, transposeKeySignature, transposeMidiFile } from './music/KeySignature'

export type KeyboardMode = '61' | '88'

export interface KeyboardRange {
  min: number
  max: number
}

export interface KeyboardHeightProfile {
  desktop: number
  portraitRatio: number
  portraitMin: number
  landscapeRatio: number
  landscapeMin: number
  landscapeMax: number
  blackKeyHeightRatio: number
  whiteKeyBottomInset: number
  whitePrimaryLabelGap: number
  blackPrimaryLabelYRatio: number
  blackSecondaryLabelYRatio: number
}

export interface KeyboardTransposeSuggestion {
  semitones: number
  label: string
}

export const KEYBOARD_MODE_RANGES: Record<KeyboardMode, KeyboardRange> = {
  '61': { min: 36, max: 96 },
  '88': { min: 21, max: 108 },
}

export const KEYBOARD_MODE_HEIGHTS: Record<KeyboardMode, KeyboardHeightProfile> = {
  '61': {
    desktop: 156,
    portraitRatio: 0.255,
    portraitMin: 166,
    landscapeRatio: 0.3,
    landscapeMin: 104,
    landscapeMax: 140,
    blackKeyHeightRatio: 0.7,
    whiteKeyBottomInset: 6,
    whitePrimaryLabelGap: 11,
    blackPrimaryLabelYRatio: 0.24,
    blackSecondaryLabelYRatio: 0.5,
  },
  '88': {
    desktop: 120,
    portraitRatio: 0.2,
    portraitMin: 140,
    landscapeRatio: 0.24,
    landscapeMin: 88,
    landscapeMax: 120,
    blackKeyHeightRatio: 0.62,
    whiteKeyBottomInset: 4,
    whitePrimaryLabelGap: 9,
    blackPrimaryLabelYRatio: 0.22,
    blackSecondaryLabelYRatio: 0.42,
  },
}

export function getKeyboardRange(mode: KeyboardMode): KeyboardRange {
  return KEYBOARD_MODE_RANGES[mode]
}

export function getKeyboardHeightProfile(mode: KeyboardMode): KeyboardHeightProfile {
  return KEYBOARD_MODE_HEIGHTS[mode]
}

export function getMidiPitchSpan(midi: MidiFile): KeyboardRange | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      if (note.pitch < min) min = note.pitch
      if (note.pitch > max) max = note.pitch
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min, max }
}

export function midiFitsKeyboardMode(midi: MidiFile, mode: KeyboardMode): boolean {
  const span = getMidiPitchSpan(midi)
  if (!span) return true
  const range = getKeyboardRange(mode)
  return span.min >= range.min && span.max <= range.max
}

export function getCompatibleTranspositions(
  midi: MidiFile,
  mode: KeyboardMode,
): KeyboardTransposeSuggestion[] {
  const suggestions: KeyboardTransposeSuggestion[] = []

  for (let semitones = -6; semitones <= 6; semitones++) {
    const shifted = transposeMidiFile(midi, semitones)
    if (!midiFitsKeyboardMode(shifted, mode)) continue
    const keyLabel = keySignatureLabel(transposeKeySignature(midi.keySignature ?? null, semitones))
    const delta = semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : String(semitones)
    suggestions.push({
      semitones,
      label: keyLabel === '-' ? delta : `${keyLabel} (${delta})`,
    })
  }

  return suggestions
}

export function shouldPromptKeyboardModeSuggestion(midi: MidiFile, mode: KeyboardMode): boolean {
  return mode === '61' && !midiFitsKeyboardMode(midi, '61')
}
