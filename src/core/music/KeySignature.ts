import type { MidiFile, MidiKeySignature, MidiNote } from '../midi/types'

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export function inferMidiKeySignature(midi: MidiFile): MidiKeySignature | null {
  const histogram = buildPitchClassHistogram(midi)
  const total = histogram.reduce((sum, n) => sum + n, 0)
  if (total <= 0) return null

  let bestTonic = 0
  let bestMode: MidiKeySignature['mode'] = 'major'
  let bestScore = Number.NEGATIVE_INFINITY
  let secondScore = Number.NEGATIVE_INFINITY

  for (let tonic = 0; tonic < 12; tonic++) {
    const majorScore = scoreProfile(histogram, tonic, MAJOR_PROFILE)
    if (majorScore > bestScore) {
      secondScore = bestScore
      bestScore = majorScore
      bestTonic = tonic
      bestMode = 'major'
    } else if (majorScore > secondScore) {
      secondScore = majorScore
    }

    const minorScore = scoreProfile(histogram, tonic, MINOR_PROFILE)
    if (minorScore > bestScore) {
      secondScore = bestScore
      bestScore = minorScore
      bestTonic = tonic
      bestMode = 'minor'
    } else if (minorScore > secondScore) {
      secondScore = minorScore
    }
  }

  return {
    tonic: PITCH_CLASSES[bestTonic]!,
    mode: bestMode,
    source: 'inferred',
    confidence: bestScore <= 0 ? 0 : Math.max(0, Math.min(1, (bestScore - secondScore) / bestScore)),
  }
}

export function keySignatureLabel(key: MidiKeySignature | null | undefined): string {
  if (!key) return '-'
  return `${key.tonic} ${key.mode === 'major' ? 'maj' : 'min'}`
}

export function transposeMidiFile(midi: MidiFile, semitones: number): MidiFile {
  if (!Number.isFinite(semitones) || semitones === 0) return midi
  const shift = Math.trunc(semitones)
  const keySignature = midi.keySignature ? transposeKeySignature(midi.keySignature, shift) : null
  return {
    ...midi,
    keySignature,
    tracks: midi.tracks.map((track) => ({
      ...track,
      notes: track.notes.map((note) => transposeNote(note, shift)),
    })),
  }
}

export function transposeKeySignature(
  key: MidiKeySignature | null | undefined,
  semitones: number,
): MidiKeySignature | null {
  if (!key) return null
  if (!Number.isFinite(semitones) || semitones === 0) return key
  return {
    ...key,
    tonic: transposePitchClass(key.tonic, Math.trunc(semitones)),
  }
}

export function buildTransposeOptions(
  baseKey: MidiKeySignature | null | undefined,
  current: number,
): Array<{ label: string; value: number }> {
  const options: Array<{ label: string; value: number }> = []
  for (let semitones = -6; semitones <= 6; semitones++) {
    options.push({
      value: semitones,
      label: formatTransposeOptionLabel(baseKey, semitones),
    })
  }
  if (!options.some((opt) => opt.value === current)) {
    options.push({
      value: current,
      label: formatTransposeOptionLabel(baseKey, current),
    })
  }
  return options
}

export function transposeDeltaToTonic(
  key: MidiKeySignature | null | undefined,
  tonic: string,
): number {
  if (!key) return 0
  const from = pitchClassIndex(key.tonic)
  const to = pitchClassIndex(tonic)
  if (from < 0 || to < 0) return 0
  const upward = wrap12(to - from)
  return upward > 6 ? upward - 12 : upward
}

export function keySignatureAtOffset(
  key: MidiKeySignature | null | undefined,
  semitones: number,
): MidiKeySignature | null {
  return transposeKeySignature(key, semitones)
}

function transposeNote(note: MidiNote, shift: number): MidiNote {
  return {
    ...note,
    pitch: clampMidi(note.pitch + shift),
  }
}

function transposePitchClass(name: string, shift: number): string {
  const idx = pitchClassIndex(name)
  if (idx < 0) return name
  return PITCH_CLASSES[wrap12(idx + shift)]!
}

function pitchClassIndex(name: string): number {
  const normalized = name.replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#')
  return PITCH_CLASSES.indexOf(normalized as (typeof PITCH_CLASSES)[number])
}

function wrap12(n: number): number {
  return ((n % 12) + 12) % 12
}

function clampMidi(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)))
}

function formatTransposeLabel(semitones: number): string {
  if (semitones === 0) return '0'
  return semitones > 0 ? `+${semitones}` : String(semitones)
}

function formatTransposeOptionLabel(
  baseKey: MidiKeySignature | null | undefined,
  semitones: number,
): string {
  if (!baseKey) return formatTransposeLabel(semitones)
  const shifted = transposeKeySignature(baseKey, semitones)
  return `${keySignatureLabel(shifted)} (${formatTransposeLabel(semitones)})`
}

function buildPitchClassHistogram(midi: MidiFile): number[] {
  const bins = new Array<number>(12).fill(0)
  for (const track of midi.tracks) {
    if (track.isDrum) continue
    for (const note of track.notes) {
      const pc = wrap12(note.pitch)
      bins[pc] = (bins[pc] ?? 0) + Math.max(0.05, note.duration) * Math.max(0.2, note.velocity)
    }
  }
  return bins
}

function scoreProfile(histogram: number[], tonic: number, profile: readonly number[]): number {
  let score = 0
  for (let degree = 0; degree < 12; degree++) {
    const index = wrap12(tonic + degree)
    score += histogram[index]! * profile[degree]!
  }
  return score
}
