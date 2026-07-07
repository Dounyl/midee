import { describe, expect, it, vi } from 'vitest'
import { createExerciseRuntime, createPlayAlongRuntime } from '@/app/runtime/learnRuntimeFactories'

const playAlongInstances: Array<{ options: unknown }> = []
const exerciseInstances: Array<{ options: unknown }> = []

vi.mock('@/features/learn/runtime/PlayAlongPageRuntime', () => ({
  PlayAlongPageRuntime: class {
    constructor(public options: unknown) {
      playAlongInstances.push(this)
    }
  },
}))

vi.mock('@/features/learn/runtime/ExercisePageRuntime', () => ({
  ExercisePageRuntime: class {
    constructor(public options: unknown) {
      exerciseInstances.push(this)
    }
  },
}))

describe('learnRuntimeFactories', () => {
  it('creates play-along runtime from narrow options', () => {
    const lifecycle = {
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
    }
    const runtime = createPlayAlongRuntime({
      services: { id: 'services' } as never,
      overlayRoot: document.createElement('div'),
      keyboardMode: { id: 'keyboard-mode' } as never,
      setLearnFileName: vi.fn(),
      updateConsolePanel: vi.fn(),
      lifecycle,
      consumePendingMidi: vi.fn(),
    })

    expect(playAlongInstances[0]?.options).toMatchObject({
      services: { id: 'services' },
      keyboardMode: { id: 'keyboard-mode' },
      onActivate: lifecycle.onActivate,
      onDeactivate: lifecycle.onDeactivate,
    })
    expect(runtime).toBe(playAlongInstances[0])
  })

  it('creates exercise runtime from page and lifecycle options', () => {
    const lifecycle = {
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
    }
    const runtime = createExerciseRuntime({
      services: { id: 'services' } as never,
      overlayRoot: document.createElement('div'),
      page: {
        routeId: 'intervals' as never,
        descriptor: { id: 'descriptor' } as never,
        onNext: vi.fn(),
      },
      lifecycle,
    })

    expect(exerciseInstances[0]?.options).toMatchObject({
      services: { id: 'services' },
      routeId: 'intervals',
      descriptor: { id: 'descriptor' },
      onActivate: lifecycle.onActivate,
      onDeactivate: lifecycle.onDeactivate,
    })
    expect(runtime).toBe(exerciseInstances[0])
  })
})
