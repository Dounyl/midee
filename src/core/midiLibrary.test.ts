import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiFile } from './midi/types'
import { listLocalMidiEntries, loadLocalMidi, saveLocalMidi } from './midiLibrary'

function installIndexedDbShim(): () => void {
  const store = new Map<string, unknown>()

  const makeRequest = <T,>(value: T): IDBRequest<T> => {
    const req = {} as IDBRequest<T>
    queueMicrotask(() => {
      ;(req as { result: T }).result = value
      req.onsuccess?.({} as Event)
    })
    return req
  }

  const objectStore = {
    put(value: { id: string }) {
      store.set(value.id, value)
      return makeRequest(value)
    },
    get(id: string) {
      return makeRequest(store.get(id))
    },
    getAll() {
      return makeRequest(Array.from(store.values()))
    },
    createIndex() {},
  }

  const indexedDb = {
    open() {
      const req = {} as IDBOpenDBRequest
      queueMicrotask(() => {
        ;(req as { result: IDBDatabase }).result = ({
          objectStoreNames: {
            contains: () => true,
          },
          createObjectStore: () => objectStore as unknown as IDBObjectStore,
          transaction: () =>
            ({
              objectStore: () => objectStore as unknown as IDBObjectStore,
            }) as unknown as IDBTransaction,
          close() {},
        } as unknown) as IDBDatabase
        req.onsuccess?.({} as Event)
      })
      return req
    },
  }

  const prev = (globalThis as { indexedDB?: typeof indexedDB }).indexedDB
  ;(globalThis as { indexedDB?: typeof indexedDB }).indexedDB =
    indexedDb as unknown as typeof indexedDB
  return () => {
    if (prev === undefined) delete (globalThis as { indexedDB?: typeof indexedDB }).indexedDB
    else (globalThis as { indexedDB?: typeof indexedDB }).indexedDB = prev
  }
}

describe('midiLibrary', () => {
  let restoreIndexedDb: () => void

  beforeEach(() => {
    restoreIndexedDb = installIndexedDbShim()
  })

  afterEach(() => {
    restoreIndexedDb()
    vi.restoreAllMocks()
  })

  it('saves and lists MIDI metadata', async () => {
    const midi: MidiFile = {
      name: 'Etude',
      duration: 12,
      bpm: 120,
      timeSignature: [4, 4],
      tracks: [{ id: 't1', name: 'Track 1', channel: 0, instrument: 0, isDrum: false, notes: [], color: 0, colorIndex: 0 }],
    }
    const file = new File([new Uint8Array([1, 2, 3])], 'etude.mid', { lastModified: 7 })
    await saveLocalMidi(file, midi)
    const entries = await listLocalMidiEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('Etude')
    expect(entries[0]?.fileName).toBe('etude.mid')
  })

  it('loads stored bytes through the MIDI parser', async () => {
    const midi: MidiFile = {
      name: 'Study',
      duration: 8,
      bpm: 96,
      timeSignature: [4, 4],
      tracks: [{ id: 't1', name: 'Track 1', channel: 0, instrument: 0, isDrum: false, notes: [], color: 0, colorIndex: 0 }],
    }
    const file = new File([new Uint8Array([9, 8, 7])], 'study.mid', { lastModified: 9 })
    const parser = await import('./midi/parser')
    const spy = vi.spyOn(parser, 'parseMidiFile').mockResolvedValue(midi)
    const saved = await saveLocalMidi(file, midi)
    const loaded = await loadLocalMidi(saved.id)
    expect(spy).toHaveBeenCalledOnce()
    expect(loaded).toBe(midi)
  })
})
