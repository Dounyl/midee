import type { MidiFile } from '../core/midi/types'

export function countNotes(midi: Pick<MidiFile, 'tracks'>): number {
  return midi.tracks.reduce((n, t) => n + t.notes.length, 0)
}

export function sanitiseFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : 'midee'
}
