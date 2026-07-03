import { describe, expect, it, vi } from 'vitest'
import { MidiModeResolution } from './MidiModeResolution'

describe('MidiModeResolution', () => {
  it('completes play-mode loads immediately when no keyboard suggestion is needed', () => {
    const completePlayLoad = vi.fn()
    const resetPlaybackTelemetry = vi.fn()
    const resumePlaybackSoon = vi.fn()
    const ensureMidiFitsCurrentMode = vi.fn(() => true)
    const resolution = new MidiModeResolution({
      keyboardMode: {
        ensureMidiFitsCurrentMode,
      } as never,
      completePlayLoad,
      resetPlaybackTelemetry,
      resumePlaybackSoon,
    })

    const midi = {
      name: 'fits.mid',
      duration: 8,
      bpm: 120,
      timeSignature: [4, 4] as [number, number],
      keySignature: null,
      tracks: [{ id: 'p1', isDrum: false, notes: [{ pitch: 60, time: 0, duration: 1 }] }],
    } as never

    const accepted = resolution.resolveSessionPlayLoad(
      midi,
      midi,
      { source: 'sample', sampleId: 'fits' },
      120,
    )

    expect(accepted).toBe(true)
    expect(completePlayLoad).toHaveBeenCalledWith(midi)
    expect(resetPlaybackTelemetry).toHaveBeenCalledOnce()
    expect(resumePlaybackSoon).toHaveBeenCalledWith(120)
  })

  it('completes and resumes play-mode loads after a keyboard transpose suggestion', () => {
    const completePlayLoad = vi.fn()
    const resetPlaybackTelemetry = vi.fn()
    const resumePlaybackSoon = vi.fn()
    const ensureMidiFitsCurrentMode = vi.fn((_midi, _sourceMidi, handlers) => {
      handlers.onTranspose(2)
      return false
    })
    const resolution = new MidiModeResolution({
      keyboardMode: {
        ensureMidiFitsCurrentMode,
      } as never,
      completePlayLoad,
      resetPlaybackTelemetry,
      resumePlaybackSoon,
    })

    const midi = {
      name: 'demo.mid',
      duration: 12,
      bpm: 120,
      timeSignature: [4, 4] as [number, number],
      keySignature: null,
      tracks: [{ id: 'p1', isDrum: false, notes: [{ pitch: 60, time: 0, duration: 1 }] }],
    } as never

    const accepted = resolution.resolveSessionPlayLoad(
      midi,
      midi,
      { source: 'sample', sampleId: 'demo' },
      120,
    )

    expect(accepted).toBe(false)
    expect(completePlayLoad).toHaveBeenCalledOnce()
    expect(resetPlaybackTelemetry).toHaveBeenCalledOnce()
    expect(resumePlaybackSoon).toHaveBeenCalledWith(120)
  })
})
