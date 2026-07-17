import {
  gainToDb,
  getContext,
  getDestination,
  getTransport,
  immediate,
  Part,
  start as toneStart,
} from 'tone'
import { createEventSignal } from '@/stores/app/eventSignal'
import type { MidiFile } from '@/types/midi/types'
import type { AudioEngine } from './AudioEngine'
import {
  createInstrument,
  type InstrumentId,
  type InstrumentRuntime,
  midiToNoteName,
} from './instruments'

export type { InstrumentId, InstrumentInfo } from './instruments'
export { INSTRUMENTS } from './instruments'

interface NoteEvent {
  note: string
  duration: number
  velocity: number
  trackId: string
}

interface PendingLiveNote {
  pitch: number
  velocity: number
}

export class SynthEngine implements AudioEngine {
  private instruments = new Map<InstrumentId, InstrumentRuntime>()
  private loadingPromises = new Map<InstrumentId, Promise<InstrumentRuntime>>()
  // Default voice is Upright (1.2 MB of our own samples) instead of the 30 MB
  // Salamander Grand set that @tonejs/piano pulls from an external CDN.
  // Much lighter on first load, more reliable offline, still musically useful.
  private currentId: InstrumentId = 'upright'
  // Emits the active instrument id while its samples/patch are loading, null
  // otherwise. Only tracks the current instrument; background preloads of
  // other voices do not flicker the signal.
  readonly loadingInstrument = createEventSignal<InstrumentId | null>(null)
  private midi: MidiFile | null = null
  // Tone.Part holding every note as a single transport entry. Replaces many
  // individual transport.schedule calls on play/seek.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private scheduledPart: Part<[number, NoteEvent]> | null = null
  private _speed = 1
  private scheduledFromTime = 0
  private readyPromise: Promise<void> = Promise.resolve()
  private liveWarmupStarted = false
  private liveWarmupPendingId: InstrumentId | null = null
  private pendingLiveNotes = new Map<number, PendingLiveNote>()
  // Latest-wins guard for play(). play() is async (awaits readyPromise +
  // Tone.start) and can race with a later pause()/seek()/play().
  private playGeneration = 0
  // Tracks the user has muted via the Tracks panel. Checked at trigger time
  // inside the scheduled Part so notes from a disabled track are skipped while
  // notes already sounding are allowed to decay naturally.
  private disabledTrackIds = new Set<string>()

  async load(source: MidiFile | AudioBuffer): Promise<void> {
    // Loading a different file must invalidate any paused transport snapshot
    // from the previous one; otherwise play() can revive the old song.
    this.resetTransport()
    if (!(source instanceof AudioBuffer)) {
      this.midi = source as MidiFile
    }
    this.disabledTrackIds.clear()
    this.readyPromise = this.ensureInstrument(this.currentId).then(() => undefined)
    return this.readyPromise
  }

  setTrackEnabled(trackId: string, enabled: boolean): void {
    if (enabled) this.disabledTrackIds.delete(trackId)
    else this.disabledTrackIds.add(trackId)
  }

  getDisabledTrackIds(): ReadonlySet<string> {
    return this.disabledTrackIds
  }

  // Kick off default instrument loading in the background. AudioContext still
  // requires a user gesture before play().
  preloadDefault(): void {
    void this.ensureInstrument(this.currentId).catch(() => undefined)
  }

  // Switch the active instrument for both scheduled and live playback.
  async setInstrument(id: InstrumentId): Promise<void> {
    if (id === this.currentId) return
    this.instruments.get(this.currentId)?.releaseAll()
    this.currentId = id
    await this.ensureInstrument(id)
    this.flushPendingLiveNotes()
  }

  get instrument(): InstrumentId {
    return this.currentId
  }

  private ensureInstrument(id: InstrumentId): Promise<InstrumentRuntime> {
    const cached = this.instruments.get(id)
    if (cached) return Promise.resolve(cached)
    const existing = this.loadingPromises.get(id)
    if (existing) return existing

    if (id === this.currentId) this.loadingInstrument.set(id)

    const clearIfCurrent = (): void => {
      if (this.loadingInstrument.value === id) this.loadingInstrument.set(null)
    }
    const promise = createInstrument(id).then(
      (inst) => {
        this.instruments.set(id, inst)
        this.loadingPromises.delete(id)
        clearIfCurrent()
        return inst
      },
      (err) => {
        this.loadingPromises.delete(id)
        clearIfCurrent()
        throw err
      },
    )
    this.loadingPromises.set(id, promise)
    return promise
  }

  async play(fromTime: number): Promise<void> {
    if (!this.midi) return
    const gen = ++this.playGeneration
    await this.readyPromise
    await toneStart()
    if (gen !== this.playGeneration) return

    const transport = getTransport()
    if (
      transport.state === 'paused' &&
      this.scheduledPart &&
      Math.abs(fromTime - this.scheduledFromTime) < 0.05
    ) {
      transport.start()
      return
    }

    this.clearScheduled()
    transport.stop()
    transport.position = 0
    this.scheduledFromTime = fromTime

    // Schedule against the nominal tempo first, then apply speed immediately
    // before transport.start() so Tone's tick conversion and MasterClock stay
    // phase-aligned after fresh play/seek.
    const nominalBpm = this.midi.bpm
    transport.bpm.value = nominalBpm

    const partEvents: [number, NoteEvent][] = []
    for (const track of this.midi.tracks) {
      const notes = track.notes
      let lo = 0
      let hi = notes.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (notes[mid]!.time < fromTime) lo = mid + 1
        else hi = mid
      }
      for (let i = lo; i < notes.length; i++) {
        const note = notes[i]!
        partEvents.push([
          note.time - fromTime,
          {
            note: midiToNoteName(note.pitch),
            duration: note.duration,
            velocity: note.velocity,
            trackId: track.id,
          },
        ])
      }
    }

    const part = new Part<[number, NoteEvent]>((time: number, ev: NoteEvent) => {
      if (this.disabledTrackIds.has(ev.trackId)) return
      const inst = this.instruments.get(this.currentId)
      inst?.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity)
    }, partEvents)
    part.start(0)
    this.scheduledPart = part

    transport.bpm.value = nominalBpm * this._speed
    transport.start()
  }

  pause(): void {
    this.playGeneration++
    getTransport().pause()
    this.stopLivePlayback()
  }

  resetTransport(): void {
    this.playGeneration++
    this.clearScheduled()
    const transport = getTransport()
    transport.stop()
    transport.position = 0
    this.stopLivePlayback()
    this.scheduledFromTime = 0
  }

  seek(time: number): void {
    const wasPlaying = getTransport().state === 'started'
    this.playGeneration++
    getTransport().stop()
    this.clearScheduled()
    this.stopLivePlayback()
    if (wasPlaying) void this.play(time)
  }

  setVolume(v: number): void {
    getDestination().volume.value = gainToDb(v)
  }

  setSpeed(s: number): void {
    this._speed = s
    getTransport().bpm.value = (this.midi?.bpm ?? 120) * s
  }

  primeLiveInput(): void {
    if (!this.liveWarmupStarted) {
      this.liveWarmupStarted = true
      void toneStart().catch(() => undefined)
    }
    this.warmCurrentLiveInstrument()
  }

  liveNoteOn(pitch: number, velocity: number): void {
    this.primeLiveInput()
    const inst = this.instruments.get(this.currentId)
    if (!inst) {
      this.pendingLiveNotes.set(pitch, { pitch, velocity })
      return
    }
    this.pendingLiveNotes.delete(pitch)
    inst.triggerAttack(midiToNoteName(pitch), immediate(), velocity)
  }

  liveNoteOff(pitch: number): void {
    if (this.pendingLiveNotes.delete(pitch)) return
    const inst = this.instruments.get(this.currentId)
    if (!inst) return
    inst.triggerRelease(midiToNoteName(pitch), immediate())
  }

  liveReleaseAll(): void {
    this.stopLivePlayback()
  }

  // Scheduled variants for loop playback. Caller supplies an AudioContext time
  // so notes land sample-accurately even if the UI thread stalls.
  scheduleNoteOn(pitch: number, velocity: number, ctxTime: number): void {
    this.primeLiveInput()
    const inst = this.instruments.get(this.currentId)
    if (!inst) return
    inst.triggerAttack(midiToNoteName(pitch), ctxTime, velocity)
  }

  scheduleNoteOff(pitch: number, ctxTime: number): void {
    const inst = this.instruments.get(this.currentId)
    if (!inst) return
    inst.triggerRelease(midiToNoteName(pitch), ctxTime)
  }

  // Exposed so non-audio modules (UI, visuals) can convert AudioContext time
  // into a setTimeout delay without importing Tone directly.
  get audioContextTime(): number {
    return getContext().currentTime
  }

  private clearScheduled(): void {
    if (this.scheduledPart) {
      this.scheduledPart.stop(0)
      this.scheduledPart.clear()
      this.scheduledPart.dispose()
      this.scheduledPart = null
    }
  }

  private releaseAllInstruments(): void {
    for (const inst of this.instruments.values()) inst.releaseAll()
  }

  private stopLivePlayback(): void {
    this.pendingLiveNotes.clear()
    this.releaseAllInstruments()
  }

  private warmCurrentLiveInstrument(): void {
    const id = this.currentId
    if (this.instruments.has(id) || this.liveWarmupPendingId === id) return
    this.liveWarmupPendingId = id
    void this.ensureInstrument(id).then(
      () => {
        if (this.liveWarmupPendingId === id) this.liveWarmupPendingId = null
        if (this.currentId === id) this.flushPendingLiveNotes()
      },
      () => {
        if (this.liveWarmupPendingId === id) this.liveWarmupPendingId = null
      },
    )
  }

  private flushPendingLiveNotes(): void {
    const inst = this.instruments.get(this.currentId)
    if (!inst || this.pendingLiveNotes.size === 0) return
    for (const { pitch, velocity } of this.pendingLiveNotes.values()) {
      inst.triggerAttack(midiToNoteName(pitch), immediate(), velocity)
    }
    this.pendingLiveNotes.clear()
  }

  dispose(): void {
    this.clearScheduled()
    getTransport().stop()
    this.stopLivePlayback()
    for (const inst of this.instruments.values()) inst.dispose()
    this.instruments.clear()
  }
}
