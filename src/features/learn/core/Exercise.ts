import type { ExerciseContext } from '@/features/learn/core/ExerciseContext'
import type { ExerciseResult } from '@/features/learn/core/Result'
import type { BusNoteEvent } from '@/services/input/InputBus'
import type { MidiFile } from '@/types/midi/types'

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

export interface ExerciseMetadata {
  id: string
  title: string
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  blurb: string
  capabilities: ExerciseCapabilities
}

export interface ExerciseDescriptor extends ExerciseMetadata {
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
