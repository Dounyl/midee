import { describe, expect, it, vi } from 'vitest'
import { createRuntimeInputOptions } from '@/app/runtime/runtimeInputOptions'

describe('createRuntimeInputOptions', () => {
  it('returns the grouped input options without widening dependencies', () => {
    const midi = { input: { id: 'midiInput' } }
    const keyboard = {
      input: { id: 'keyboardInput' },
      syncOctave: vi.fn(),
    }
    const touch = {
      canvas: { id: 'canvas' },
      getCurrentTime: vi.fn(() => 42),
      getStatus: vi.fn(() => 'playing'),
      resolvePitch: vi.fn(() => 60),
      primeInteractiveAudio: vi.fn(),
    }
    const bridge = {
      inputBus: { id: 'inputBus' },
      performanceBus: { id: 'performanceBus' },
      onPedalUsed: vi.fn(),
      onLiveNoteOn: vi.fn(),
      onLiveNoteOff: vi.fn(),
    }

    const options = createRuntimeInputOptions({
      midi: midi as never,
      keyboard: keyboard as never,
      touch: touch as never,
      bridge: bridge as never,
    })

    expect(options.midi).toBe(midi)
    expect(options.keyboard).toBe(keyboard)
    expect(options.touch).toBe(touch)
    expect(options.bridge).toBe(bridge)
  })
})
