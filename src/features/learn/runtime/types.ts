import type { ExerciseDescriptor } from '@/features/learn/core/Exercise'
import type { LearnState } from '@/features/learn/core/LearnState'
import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type { EventSignal } from '@/stores/app/eventSignal'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export interface LearnConsoleState {
  enabled: boolean
  baseKey: MidiKeySignature | null
  current: number
}

export interface LearnRuntimeHandle {
  readonly routeId: ExerciseRouteId
  enter(): void | Promise<void>
  exit(): void
}

export interface ConsoleStateProvider {
  getConsoleState(): LearnConsoleState
}

export interface TransposeAwareRuntime {
  setTranspose(semitones: number): void
}

export interface MidiBackedRuntime {
  getLoadedMidi(): MidiFile | null
}

export interface PlayAlongPreparedMidiConsumer {
  loadPreparedMidi(midi: MidiFile): Promise<void>
}

export interface PlayAlongPageRuntimeHandle
  extends LearnRuntimeHandle,
    ConsoleStateProvider,
    TransposeAwareRuntime,
    MidiBackedRuntime,
    PlayAlongPreparedMidiConsumer {
  readonly learnState: LearnState
  readonly view: EventSignal<'page' | 'exercise'>
  startPlayAlong(): Promise<void>
  returnToList(): void
}

export interface CreateExercisePageRuntimeOptions {
  routeId: ExerciseRouteId
  descriptor: ExerciseDescriptor
  onNext: () => void
}

export interface ExercisePageRuntimeHandle extends LearnRuntimeHandle {
  enter(): Promise<void>
}
