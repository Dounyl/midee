import type {
  ConsoleStateProvider,
  LearnRuntimeHandle,
  MidiBackedRuntime,
  PlayAlongPreparedMidiConsumer,
  TransposeAwareRuntime,
} from '@/features/learn/runtime/types'
import type { MidiFile } from '@/types/midi/types'

function hasConsoleState(
  runtime: LearnRuntimeHandle,
): runtime is LearnRuntimeHandle & ConsoleStateProvider {
  return 'getConsoleState' in runtime
}

function hasLoadedMidi(
  runtime: LearnRuntimeHandle,
): runtime is LearnRuntimeHandle & MidiBackedRuntime {
  return 'getLoadedMidi' in runtime
}

function hasTranspose(
  runtime: LearnRuntimeHandle,
): runtime is LearnRuntimeHandle & TransposeAwareRuntime {
  return 'setTranspose' in runtime
}

function canConsumePreparedMidi(
  runtime: LearnRuntimeHandle,
): runtime is LearnRuntimeHandle & PlayAlongPreparedMidiConsumer {
  return 'loadPreparedMidi' in runtime
}

export class ActiveLearnRuntimeRegistry {
  private active: LearnRuntimeHandle | null = null
  private pendingPreparedPlayAlongMidi: MidiFile | null = null

  register(runtime: LearnRuntimeHandle): void {
    this.active = runtime
  }

  unregister(runtime: LearnRuntimeHandle): void {
    if (this.active === runtime) this.active = null
  }

  getActiveRuntime(): LearnRuntimeHandle | null {
    return this.active
  }

  getConsoleStateProvider(): ConsoleStateProvider | null {
    return this.active && hasConsoleState(this.active) ? this.active : null
  }

  getMidiBackedRuntime(): MidiBackedRuntime | null {
    return this.active && hasLoadedMidi(this.active) ? this.active : null
  }

  getTransposeAwareRuntime(): TransposeAwareRuntime | null {
    return this.active && hasTranspose(this.active) ? this.active : null
  }

  getPreparedMidiConsumer(): PlayAlongPreparedMidiConsumer | null {
    return this.active && canConsumePreparedMidi(this.active) ? this.active : null
  }

  stagePreparedPlayAlongMidi(midi: MidiFile): void {
    this.pendingPreparedPlayAlongMidi = midi
  }

  consumePreparedPlayAlongMidi(): MidiFile | null {
    const midi = this.pendingPreparedPlayAlongMidi
    this.pendingPreparedPlayAlongMidi = null
    return midi
  }
}
