import type { MidiKeySignature } from '@/types/midi/types'

// Key-signature-aware jianpu labels used by the piano-roll overlays.
// The tonic of the current key becomes "1"; chromatic notes are spelled
// against the nearest scale degree so flat keys favour labels like "b7"
// where that is musically clearer than "#6".

const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const
const MINOR_SCALE_OFFSETS = [0, 2, 3, 5, 7, 8, 10] as const
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
const NATURAL_PITCH_CLASSES: Record<(typeof NOTE_LETTERS)[number], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
const NEUTRAL_CHROMATIC_PREFERENCE: Partial<Record<number, 'sharp' | 'flat'>> = {
  1: 'sharp',
  3: 'flat',
  6: 'sharp',
  8: 'flat',
  10: 'flat',
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
type NoteLetter = (typeof NOTE_LETTERS)[number]
type AccidentalPreference = 'sharp' | 'flat' | 'neutral'

interface ScaleDegreeInfo {
  degree: number
  letter: NoteLetter
  noteName: string
  pitchClass: number
  accidental: number
}

interface ResolvedKeyInfo {
  tonicPitchClass: number
  mode: 'major' | 'minor'
  scale: readonly ScaleDegreeInfo[]
  accidentalPreference: AccidentalPreference
}

interface ChromaticDegreeCandidate {
  degree: number
  diff: -1 | 1
  noteName: string
  absoluteAccidentalCount: number
}

export interface KeyboardPitchLabels {
  jianpu: string
  noteName: string
}

function normalizePitchClass(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12
}

function normalizeSemitoneDelta(delta: number): number {
  const wrapped = normalizePitchClass(delta)
  return wrapped > 6 ? wrapped - 12 : wrapped
}

function accidentalSuffix(accidental: number): string {
  if (accidental === 0) return ''
  if (accidental > 0) return '#'.repeat(accidental)
  return 'b'.repeat(-accidental)
}

function buildNoteName(letter: NoteLetter, accidental: number): string {
  return `${letter}${accidentalSuffix(accidental)}`
}

function parseNoteName(noteName: string): { letter: NoteLetter; accidental: number } | null {
  const [head, ...tail] = noteName.trim()
  const letter = head?.toUpperCase() as NoteLetter | undefined
  if (!letter || !(letter in NOTE_LETTER_INDEX)) return null

  let accidental = 0
  for (const char of tail.join('')) {
    if (char === '#') accidental += 1
    else if (char === 'b') accidental -= 1
  }
  return { letter, accidental }
}

function rotateLetter(letter: NoteLetter, steps: number): NoteLetter {
  const next = (NOTE_LETTER_INDEX[letter] + steps) % NOTE_LETTERS.length
  return NOTE_LETTERS[next]!
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

function accidentalPreferenceForScale(scale: readonly ScaleDegreeInfo[]): AccidentalPreference {
  const hasSharps = scale.some((degree) => degree.accidental > 0)
  const hasFlats = scale.some((degree) => degree.accidental < 0)
  if (hasSharps && !hasFlats) return 'sharp'
  if (hasFlats && !hasSharps) return 'flat'
  return 'neutral'
}

function resolveKeyInfo(keySignature?: JianpuKeySignature): ResolvedKeyInfo {
  const normalized = normalizeKeySignature(keySignature)
  const mode = normalized?.endsWith('m') ? 'minor' : 'major'
  const tonicName = normalized ? (mode === 'minor' ? normalized.slice(0, -1) : normalized) : 'C'
  const tonicInfo = parseNoteName(tonicName)
  const tonicLetter = tonicInfo?.letter ?? 'C'
  const tonicPitchClass =
    KEY_TO_TONIC_PC[normalized ?? ''] ??
    normalizePitchClass(NATURAL_PITCH_CLASSES[tonicLetter] + (tonicInfo?.accidental ?? 0))
  const scaleOffsets = mode === 'minor' ? MINOR_SCALE_OFFSETS : MAJOR_SCALE_OFFSETS

  const scale = scaleOffsets.map((offset, index) => {
    const letter = rotateLetter(tonicLetter, index)
    const pitchClass = normalizePitchClass(tonicPitchClass + offset)
    const accidental = normalizeSemitoneDelta(pitchClass - NATURAL_PITCH_CLASSES[letter])
    return {
      degree: index + 1,
      letter,
      noteName: buildNoteName(letter, accidental),
      pitchClass,
      accidental,
    }
  })

  return {
    tonicPitchClass,
    mode,
    scale,
    accidentalPreference: accidentalPreferenceForScale(scale),
  }
}

function preferredChromaticDirection(
  pitchClass: number,
  accidentalPreference: AccidentalPreference,
): -1 | 1 {
  if (accidentalPreference === 'sharp') return 1
  if (accidentalPreference === 'flat') return -1
  return NEUTRAL_CHROMATIC_PREFERENCE[pitchClass] === 'flat' ? -1 : 1
}

function findScaleDegree(
  pitchClass: number,
  scale: readonly ScaleDegreeInfo[],
): ScaleDegreeInfo | undefined {
  return scale.find((degree) => degree.pitchClass === normalizePitchClass(pitchClass))
}

function chooseChromaticDegree(
  pitchClass: number,
  keyInfo: ResolvedKeyInfo,
): ChromaticDegreeCandidate {
  const normalizedPitch = normalizePitchClass(pitchClass)
  const candidates: ChromaticDegreeCandidate[] = []

  for (const degree of keyInfo.scale) {
    const diff = normalizeSemitoneDelta(normalizedPitch - degree.pitchClass)
    if (Math.abs(diff) !== 1) continue
    const nextAccidental = degree.accidental + diff
    candidates.push({
      degree: degree.degree,
      diff: diff as -1 | 1,
      noteName: buildNoteName(degree.letter, nextAccidental),
      absoluteAccidentalCount: Math.abs(nextAccidental),
    })
  }

  if (candidates.length === 0) {
    return {
      degree: 1,
      diff: 1,
      noteName: buildNoteName(keyInfo.scale[0]!.letter, keyInfo.scale[0]!.accidental + 1),
      absoluteAccidentalCount: Math.abs(keyInfo.scale[0]!.accidental + 1),
    }
  }

  const preferredDirection = preferredChromaticDirection(
    normalizedPitch,
    keyInfo.accidentalPreference,
  )

  candidates.sort((left, right) => {
    if (left.absoluteAccidentalCount !== right.absoluteAccidentalCount) {
      return left.absoluteAccidentalCount - right.absoluteAccidentalCount
    }
    if (left.diff !== right.diff) {
      if (left.diff === preferredDirection) return -1
      if (right.diff === preferredDirection) return 1
    }
    return right.degree - left.degree
  })

  return candidates[0]!
}

export function tonicPitchClassForKeySignature(keySignature?: JianpuKeySignature): number {
  return resolveKeyInfo(keySignature).tonicPitchClass
}

export function pitchClassToJianpuLabel(
  pitchClass: number,
  keySignature?: JianpuKeySignature,
): string {
  const keyInfo = resolveKeyInfo(keySignature)
  const scaleDegree = findScaleDegree(pitchClass, keyInfo.scale)
  if (scaleDegree) return String(scaleDegree.degree)

  const chromaticDegree = chooseChromaticDegree(pitchClass, keyInfo)
  return `${chromaticDegree.diff > 0 ? '#' : 'b'}${chromaticDegree.degree}`
}

export function pitchToJianpuLabel(pitch: number, keySignature?: JianpuKeySignature): string {
  return pitchClassToJianpuLabel(pitch, keySignature)
}

export function pitchToSpelledNoteName(pitch: number, keySignature?: JianpuKeySignature): string {
  const keyInfo = resolveKeyInfo(keySignature)
  const scaleDegree = findScaleDegree(pitch, keyInfo.scale)
  if (scaleDegree) return scaleDegree.noteName
  return chooseChromaticDegree(pitch, keyInfo).noteName
}

export function pitchToKeyboardLabels(
  pitch: number,
  keySignature?: JianpuKeySignature,
): KeyboardPitchLabels | null {
  const scaleDegree = findScaleDegree(pitch, resolveKeyInfo(keySignature).scale)
  if (!scaleDegree) return null
  return {
    jianpu: String(scaleDegree.degree),
    noteName: scaleDegree.letter.toLowerCase(),
  }
}

export function shouldRenderKeyboardJianpuLabels(keySignature?: JianpuKeySignature): boolean {
  return resolveKeyInfo(keySignature).scale.length === 7
}
