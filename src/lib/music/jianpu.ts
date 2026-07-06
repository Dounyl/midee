import type { MidiKeySignature } from '@/types/midi/types'

// Key-signature-aware jianpu labels used by the piano-roll overlays.
// The tonic of the current key becomes "1"; accidentals are rendered
// relative to that tonic. Unknown or missing keys fall back to C major.

const DEGREE_LABELS = ['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7']
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE_OFFSETS = [0, 2, 3, 5, 7, 8, 10]
const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const NOTE_LETTER_INDEX: Record<(typeof NOTE_LETTERS)[number], number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
}

const KEY_TO_TONIC_PC: Record<string, number> = {
  C: 0,
  G: 7,
  D: 2,
  A: 9,
  E: 4,
  B: 11,
  'F#': 6,
  'C#': 1,
  F: 5,
  Bb: 10,
  Eb: 3,
  Ab: 8,
  Db: 1,
  Gb: 6,
  Cb: 11,
  Am: 9,
  Em: 4,
  Bm: 11,
  'F#m': 6,
  'C#m': 1,
  'G#m': 8,
  'D#m': 3,
  'A#m': 10,
  Dm: 2,
  Gm: 7,
  Cm: 0,
  Fm: 5,
  Bbm: 10,
  Ebm: 3,
  Abm: 8,
}

type JianpuKeySignature = MidiKeySignature | string | null | undefined

export interface KeyboardPitchLabels {
  jianpu: string
  noteName: string
}

function normalizePitchClass(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12
}

function normalizeKeySignature(keySignature?: JianpuKeySignature): string | null {
  if (!keySignature) return null
  const raw =
    typeof keySignature === 'string'
      ? keySignature
      : keySignature.mode === 'minor'
        ? `${keySignature.tonic}m`
        : keySignature.tonic
  const trimmed = raw
    .trim()
    .replace(/\u266d/g, 'b')
    .replace(/\u266f/g, '#')
  if (trimmed.length === 0) return null
  const lowered = trimmed.toLowerCase()
  const isMinor = lowered.endsWith('m')
  const core = isMinor ? trimmed.slice(0, -1) : trimmed
  const canonical = core.length === 0 ? core : core[0]!.toUpperCase() + core.slice(1)
  return isMinor ? `${canonical}m` : canonical
}

function resolveKeyInfo(keySignature?: JianpuKeySignature): {
  tonicPitchClass: number
  tonicLetter: (typeof NOTE_LETTERS)[number]
  mode: 'major' | 'minor'
} {
  const normalized = normalizeKeySignature(keySignature)
  const mode = normalized?.endsWith('m') ? 'minor' : 'major'
  const tonic = normalized ? (mode === 'minor' ? normalized.slice(0, -1) : normalized) : 'C'
  const tonicLetter = tonic[0]?.toUpperCase() as (typeof NOTE_LETTERS)[number] | undefined
  return {
    tonicPitchClass: KEY_TO_TONIC_PC[normalized ?? ''] ?? 0,
    tonicLetter: tonicLetter && tonicLetter in NOTE_LETTER_INDEX ? tonicLetter : 'C',
    mode,
  }
}

export function tonicPitchClassForKeySignature(keySignature?: JianpuKeySignature): number {
  const normalized = normalizeKeySignature(keySignature)
  return KEY_TO_TONIC_PC[normalized ?? ''] ?? 0
}

export function pitchClassToJianpuLabel(
  pitchClass: number,
  keySignature?: JianpuKeySignature,
): string {
  const tonic = tonicPitchClassForKeySignature(keySignature)
  const relative = normalizePitchClass(pitchClass - tonic)
  return DEGREE_LABELS[relative]!
}

export function pitchToJianpuLabel(pitch: number, keySignature?: JianpuKeySignature): string {
  return pitchClassToJianpuLabel(pitch, keySignature)
}

export function pitchToKeyboardLabels(
  pitch: number,
  keySignature?: JianpuKeySignature,
): KeyboardPitchLabels | null {
  const info = resolveKeyInfo(keySignature)
  const scaleOffsets = info.mode === 'minor' ? MINOR_SCALE_OFFSETS : MAJOR_SCALE_OFFSETS
  const relative = normalizePitchClass(pitch - info.tonicPitchClass)
  const degreeIndex = scaleOffsets.indexOf(relative)
  if (degreeIndex < 0) return null
  const tonicLetterIndex = NOTE_LETTER_INDEX[info.tonicLetter]
  return {
    jianpu: String(degreeIndex + 1),
    noteName: NOTE_LETTERS[(tonicLetterIndex + degreeIndex) % NOTE_LETTERS.length]!.toLowerCase(),
  }
}

export function shouldRenderKeyboardJianpuLabels(keySignature?: JianpuKeySignature): boolean {
  return pitchToKeyboardLabels(60, keySignature) !== null
}
