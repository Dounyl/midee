import { describe, expect, it, vi } from 'vitest'
import { createLearnState } from '@/features/learn/core/LearnState'
import { ActiveLearnRuntimeRegistry } from '@/features/learn/runtime/ActiveLearnRuntimeRegistry'
import type {
  ExercisePageRuntimeHandle,
  PlayAlongPageRuntimeHandle,
} from '@/features/learn/runtime/types'
import { createEventSignal } from '@/stores/app/eventSignal'
import type { MidiFile } from '@/types/midi/types'

function createMidi(name: string): MidiFile {
  return {
    name,
    duration: 1,
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [],
  }
}

function createPlayAlongRuntime(): PlayAlongPageRuntimeHandle {
  return {
    routeId: 'play-along',
    learnState: createLearnState(),
    view: createEventSignal<'page' | 'exercise'>('page'),
    enter: vi.fn(),
    exit: vi.fn(),
    startPlayAlong: vi.fn(async () => {}),
    returnToList: vi.fn(),
    loadPreparedMidi: vi.fn(async () => {}),
    getConsoleState: vi.fn(() => ({ enabled: true, baseKey: null, current: 2 })),
    setTranspose: vi.fn(),
    getLoadedMidi: vi.fn(() => createMidi('loaded')),
  }
}

function createExerciseRuntime(): ExercisePageRuntimeHandle {
  return {
    routeId: 'intervals',
    enter: vi.fn(async () => {}),
    exit: vi.fn(),
  }
}

describe('ActiveLearnRuntimeRegistry', () => {
  it('exposes play-along capabilities only for the active play-along runtime', () => {
    const registry = new ActiveLearnRuntimeRegistry()
    const runtime = createPlayAlongRuntime()

    registry.register(runtime)

    expect(registry.getActiveRuntime()).toBe(runtime)
    expect(registry.getConsoleStateProvider()).toBe(runtime)
    expect(registry.getTransposeAwareRuntime()).toBe(runtime)
    expect(registry.getMidiBackedRuntime()).toBe(runtime)
    expect(registry.getPreparedMidiConsumer()).toBe(runtime)

    registry.unregister(runtime)

    expect(registry.getActiveRuntime()).toBeNull()
    expect(registry.getConsoleStateProvider()).toBeNull()
    expect(registry.getTransposeAwareRuntime()).toBeNull()
    expect(registry.getMidiBackedRuntime()).toBeNull()
    expect(registry.getPreparedMidiConsumer()).toBeNull()
  })

  it('does not expose play-along capabilities for non-midi learn runtimes', () => {
    const registry = new ActiveLearnRuntimeRegistry()
    const runtime = createExerciseRuntime()

    registry.register(runtime)

    expect(registry.getActiveRuntime()).toBe(runtime)
    expect(registry.getConsoleStateProvider()).toBeNull()
    expect(registry.getTransposeAwareRuntime()).toBeNull()
    expect(registry.getMidiBackedRuntime()).toBeNull()
    expect(registry.getPreparedMidiConsumer()).toBeNull()
  })

  it('consumes staged prepared midi only once', () => {
    const registry = new ActiveLearnRuntimeRegistry()
    const midi = createMidi('prepared')

    registry.stagePreparedPlayAlongMidi(midi)

    expect(registry.consumePreparedPlayAlongMidi()).toBe(midi)
    expect(registry.consumePreparedPlayAlongMidi()).toBeNull()
  })
})
