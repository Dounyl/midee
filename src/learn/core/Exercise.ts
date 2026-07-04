import type { BusNoteEvent } from '../../core/input/InputBus'
import type { MidiFile } from '../../core/midi/types'
import type { ExerciseContext } from './ExerciseContext'
import type { ExerciseResult } from './Result'

export type ExerciseCategory =
  | 'play-along'
  | 'sight-reading'
  | 'ear-training'
  | 'theory'
  | 'technique'
  | 'reflection'

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface ExerciseCapabilities {
  requiresLoadedMidi: boolean
  usesOverlay: boolean
  usesInputBus: boolean
  supportsMidiReplacement: boolean
}

export interface ExerciseDescriptor {
  id: string
  title: string
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  blurb: string
  capabilities: ExerciseCapabilities
  factory: (ctx: ExerciseContext) => Exercise
  preload?: () => Promise<void>
}

export interface Exercise {
  readonly descriptor: ExerciseDescriptor
  mount(host: HTMLElement): void | Promise<void>
  start(): void
  stop(): void
  unmount(): void
  onNoteOn?(evt: BusNoteEvent): void
  onNoteOff?(evt: BusNoteEvent): void
  onTick?(time: number): void
  onMidiReplaced?(midi: MidiFile): void
  result(): ExerciseResult | null
}
