import { describe, expect, it, vi } from 'vitest'
import type { MidiFile } from '@/types/midi/types'
import { KeyboardModeCoordinator } from './KeyboardModeCoordinator'

function makeMidi(pitches: number[]): MidiFile {
  return {
    name: 'test',
    duration: 1,
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        channel: 0,
        instrument: 0,
        isDrum: false,
        color: 0xffffff,
        colorIndex: 0,
        notes: pitches.map((pitch, i) => ({
          pitch,
          time: i,
          duration: 0.5,
          velocity: 0.8,
        })),
      },
    ],
  }
}

describe('KeyboardModeCoordinator', () => {
  it('applies a compatible manual switch to 61 keys immediately', () => {
    const persistMode = vi.fn()
    const applyMode = vi.fn()
    const syncConsolePanel = vi.fn()
    const promptSuggestion = vi.fn()
    const coordinator = new KeyboardModeCoordinator({
      initialMode: '88',
      persistMode,
      applyMode,
      syncConsolePanel,
      promptSuggestion,
    })

    coordinator.requestModeChange('61', makeMidi([36, 60, 96]), {
      onTranspose: vi.fn(),
    })

    expect(coordinator.getMode()).toBe('61')
    expect(persistMode).toHaveBeenCalledWith('61')
    expect(applyMode).toHaveBeenCalledWith('61')
    expect(syncConsolePanel).toHaveBeenCalledOnce()
    expect(promptSuggestion).not.toHaveBeenCalled()
  })

  it('prompts with absolute transpose targets when a manual 61-key switch needs suggestions', async () => {
    const promptSuggestion = vi.fn()
    const coordinator = new KeyboardModeCoordinator({
      initialMode: '88',
      persistMode: vi.fn(),
      applyMode: vi.fn(),
      syncConsolePanel: vi.fn(),
      promptSuggestion,
    })
    const onTranspose = vi.fn()

    coordinator.requestModeChange('61', makeMidi([35, 60, 95]), { onTranspose }, 2)

    const request = promptSuggestion.mock.calls[0]?.[0]
    expect(request).toBeTruthy()
    expect(request.options.some((option: { semitones: number }) => option.semitones === 3)).toBe(
      true,
    )

    await request.onTranspose(3)

    expect(coordinator.getMode()).toBe('61')
    expect(onTranspose).toHaveBeenCalledWith(3)
  })

  it('shows the no-suggestion state when a manual 61-key switch has no compatible transpositions', () => {
    const promptSuggestion = vi.fn()
    const coordinator = new KeyboardModeCoordinator({
      initialMode: '88',
      persistMode: vi.fn(),
      applyMode: vi.fn(),
      syncConsolePanel: vi.fn(),
      promptSuggestion,
    })

    coordinator.requestModeChange('61', makeMidi([20, 60, 110]), {
      onTranspose: vi.fn(),
    })

    const request = promptSuggestion.mock.calls[0]?.[0]
    expect(request.options).toEqual([])
    expect(coordinator.getMode()).toBe('88')
  })

  it('prompts when a newly loaded midi no longer fits the current 61-key mode', async () => {
    const persistMode = vi.fn()
    const applyMode = vi.fn()
    const syncConsolePanel = vi.fn()
    const promptSuggestion = vi.fn()
    const coordinator = new KeyboardModeCoordinator({
      initialMode: '61',
      persistMode,
      applyMode,
      syncConsolePanel,
      promptSuggestion,
    })
    const onTranspose = vi.fn()
    const onSwitchTo88 = vi.fn()

    const accepted = coordinator.ensureMidiFitsCurrentMode(
      makeMidi([35, 60, 95]),
      makeMidi([35, 60, 95]),
      {
        onTranspose,
        onSwitchTo88,
      },
    )

    expect(accepted).toBe(false)
    const request = promptSuggestion.mock.calls[0]?.[0]
    expect(request.options.some((option: { semitones: number }) => option.semitones === 1)).toBe(
      true,
    )

    await request.onTranspose(1)

    expect(coordinator.getMode()).toBe('61')
    expect(onTranspose).toHaveBeenCalledWith(1)
    expect(applyMode).not.toHaveBeenCalledWith('88')

    await request.onSwitchTo88()

    expect(coordinator.getMode()).toBe('88')
    expect(persistMode).toHaveBeenCalledWith('88')
    expect(applyMode).toHaveBeenCalledWith('88')
    expect(syncConsolePanel).toHaveBeenCalledOnce()
    expect(onSwitchTo88).toHaveBeenCalledOnce()
  })
})
