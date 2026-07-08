import { describe, expect, it, vi } from 'vitest'
import {
  requestConsoleKeyboardModeChange,
  resolveConsoleResetTranspose,
} from '@/app/runtime/bootstrapConsole'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import type { MidiFile } from '@/types/midi/types'

describe('resolveConsoleResetTranspose', () => {
  it('prefers learn runtime key when present', () => {
    expect(
      resolveConsoleResetTranspose({
        learnBaseKey: { tonic: 'D', mode: 'major', source: 'midi', confidence: 1 },
        playBaseKey: { tonic: 'E', mode: 'major', source: 'midi', confidence: 1 },
      }),
    ).toBe(-2)
  })

  it('falls back to play key and returns 0 when no key exists', () => {
    expect(
      resolveConsoleResetTranspose({
        learnBaseKey: null,
        playBaseKey: { tonic: 'F#', mode: 'minor', source: 'midi', confidence: 1 },
      }),
    ).toBe(6)
    expect(
      resolveConsoleResetTranspose({
        learnBaseKey: null,
        playBaseKey: null,
      }),
    ).toBe(0)
  })
})

describe('requestConsoleKeyboardModeChange', () => {
  it('passes the active midi and transpose callback through to the coordinator', () => {
    const midi = {
      name: 'test.mid',
      tracks: [],
      duration: 0,
      bpm: 120,
      timeSignature: [4, 4],
      keySignature: null,
    } as unknown as MidiFile
    const requestModeChange = vi.fn()
    const onTranspose = vi.fn()

    requestConsoleKeyboardModeChange({
      mode: '61',
      coordinator: { requestModeChange } as unknown as KeyboardModeCoordinator,
      activeMidi: midi,
      currentTranspose: 2,
      onTranspose,
    })

    expect(requestModeChange).toHaveBeenCalledWith(
      '61',
      midi,
      expect.objectContaining({ onTranspose }),
      2,
    )
  })
})
