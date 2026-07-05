import { parseMidiFile } from './midi/parser'
import type { MidiFile } from './midi/types'

const DB_NAME = 'midee-midi-library'
const DB_VERSION = 1
const STORE_NAME = 'midis'
const LOCAL_MIDI_LIMIT = 20
export const MIDI_LIBRARY_CHANGED = 'midee:midi-library-changed'
const SAMPLE_HISTORY_KEY = 'midee.sample-history'

export interface LocalMidiEntry {
  id: string
  name: string
  fileName: string
  size: number
  updatedAt: number
  lastPlayedAt: number
  duration: number
  trackCount: number
  noteCount: number
}

interface StoredLocalMidi extends LocalMidiEntry {
  bytes: ArrayBuffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    req.onerror = () => reject(req.error ?? new Error('Could not open MIDI library.'))
    req.onsuccess = () => resolve(req.result)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available.'))
  }
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const req = run(tx.objectStore(STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('MIDI library request failed.'))
        tx.oncomplete = () => db.close()
        tx.onabort = () => {
          db.close()
          reject(tx.error ?? new Error('MIDI library transaction aborted.'))
        }
      }),
  )
}

function entryId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`
}

function countNotes(midi: MidiFile): number {
  return midi.tracks.reduce((sum, track) => sum + track.notes.length, 0)
}

function sortByRecency<T extends Pick<LocalMidiEntry, 'lastPlayedAt' | 'updatedAt'>>(
  entries: T[],
): T[] {
  return entries.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || b.updatedAt - a.updatedAt)
}

function stripBytes({ bytes: _bytes, ...entry }: StoredLocalMidi): LocalMidiEntry {
  return entry
}

async function trimLocalMidiLibrary(limit = LOCAL_MIDI_LIMIT): Promise<void> {
  const rows = await withStore<StoredLocalMidi[]>('readonly', (store) => store.getAll())
  const staleRows = sortByRecency(rows).slice(limit)
  await Promise.all(staleRows.map((row) => withStore('readwrite', (store) => store.delete(row.id))))
}

function announceChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MIDI_LIBRARY_CHANGED))
}

function safeLoadSampleHistory(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SAMPLE_HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function safeSaveSampleHistory(value: Record<string, number>): void {
  try {
    localStorage.setItem(SAMPLE_HISTORY_KEY, JSON.stringify(value))
  } catch {
    // Best-effort only.
  }
}

export async function saveLocalMidi(file: File, midi: MidiFile): Promise<LocalMidiEntry> {
  const bytes = await file.arrayBuffer()
  const entry: StoredLocalMidi = {
    id: entryId(file),
    name: midi.name,
    fileName: file.name,
    size: file.size,
    updatedAt: Date.now(),
    lastPlayedAt: Date.now(),
    duration: midi.duration,
    trackCount: midi.tracks.length,
    noteCount: countNotes(midi),
    bytes,
  }
  await withStore('readwrite', (store) => store.put(entry))
  await trimLocalMidiLibrary()
  announceChange()
  return stripBytes(entry)
}

export async function listLocalMidiEntries(limit = 8): Promise<LocalMidiEntry[]> {
  const rows = await withStore<StoredLocalMidi[]>('readonly', (store) => store.getAll())
  return sortByRecency(rows.map(stripBytes)).slice(0, Math.max(0, limit))
}

export async function loadLocalMidi(id: string): Promise<MidiFile> {
  const row = await withStore<StoredLocalMidi | undefined>('readonly', (store) => store.get(id))
  if (!row) throw new Error('Local MIDI not found.')
  await withStore('readwrite', (store) => {
    row.updatedAt = Date.now()
    row.lastPlayedAt = Date.now()
    return store.put(row)
  })
  announceChange()
  return parseMidiFile(row.bytes.slice(0), row.name)
}

export function recordSamplePlayback(sampleId: string): void {
  const history = safeLoadSampleHistory()
  history[sampleId] = Date.now()
  safeSaveSampleHistory(history)
  announceChange()
}

export function loadSamplePlaybackHistory(): Record<string, number> {
  return safeLoadSampleHistory()
}
