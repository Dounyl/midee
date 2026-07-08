import { describe, expect, it, vi } from 'vitest'
import { wireRuntimeInput } from '@/app/runtime/wireRuntimeInput'

function createSignalMock<T>() {
  const subs: Array<(value: T) => void> = []
  return {
    subs,
    subscribe(fn: (value: T) => void) {
      subs.push(fn)
      return vi.fn(() => {
        const index = subs.indexOf(fn)
        if (index >= 0) subs.splice(index, 1)
      })
    },
  }
}

describe('wireRuntimeInput', () => {
  it('returns grouped subscriptions for midi, keyboard, and performance bridge', () => {
    const midiNoteOn = createSignalMock<unknown | null>()
    const midiNoteOff = createSignalMock<unknown | null>()
    const midiPedal = createSignalMock<boolean>()
    const keyNoteOn = createSignalMock<unknown | null>()
    const keyNoteOff = createSignalMock<unknown | null>()
    const keyPedal = createSignalMock<boolean>()
    const keyOctave = createSignalMock<number>()
    const busNoteOn = createSignalMock<unknown | null>()
    const busNoteOff = createSignalMock<unknown | null>()
    const performanceOn: Array<(value: unknown) => void> = []
    const performanceOff: Array<(value: unknown) => void> = []
    const canvasPointerHandlers = new Map<string, (event?: unknown) => void>()
    const inputBus = {
      emitNoteOn: vi.fn(),
      emitNoteOff: vi.fn(),
      emitPedal: vi.fn(),
      noteOn: busNoteOn,
      noteOff: busNoteOff,
    }
    const ui = { syncOctave: vi.fn() }
    const onPedalUsed = vi.fn()
    const onLiveNoteOn = vi.fn()
    const onLiveNoteOff = vi.fn()
    const synth = {
      liveNoteOn: vi.fn(),
      liveNoteOff: vi.fn(),
    }
    const liveNotes = {
      press: vi.fn(),
    }
    const capture = {
      captureNoteOff: vi.fn(),
    }

    const groups = wireRuntimeInput({
      midi: {
        input: {
          noteOn: midiNoteOn,
          noteOff: midiNoteOff,
          pedal: midiPedal,
        } as never,
      },
      keyboard: {
        input: {
          noteOn: keyNoteOn,
          noteOff: keyNoteOff,
          pedal: keyPedal,
          octave: keyOctave,
        } as never,
        syncOctave: ui.syncOctave,
      },
      touch: {
        canvas: {
          addEventListener: vi.fn((type, handler) => {
            canvasPointerHandlers.set(type, handler)
          }),
          removeEventListener: vi.fn(),
        } as never,
        getCurrentTime: () => 42,
        getStatus: () => 'playing',
        resolvePitch: vi.fn((clientX: number) => (clientX === 10 ? 60 : 62)),
        primeInteractiveAudio: vi.fn(),
      },
      bridge: {
        inputBus: inputBus as never,
        performanceBus: {
          subscribeNotes: vi.fn((onNoteOn, onNoteOff) => {
            performanceOn.push(onNoteOn)
            performanceOff.push(onNoteOff)
            return vi.fn()
          }),
          routePedalDown: vi.fn(),
          routePedalUp: vi.fn(),
        } as never,
        synth: synth as never,
        liveNotes: liveNotes as never,
        capture: capture as never,
        getCurrentTime: () => 42,
        shouldCapturePerformance: () => true,
        onPedalUsed,
        onLiveNoteOn,
        onLiveNoteOff,
      },
    })

    expect(groups.map((group) => group.label)).toEqual([
      'midi-source-input',
      'keyboard-source-input',
      'performance-bridge-input',
      'touch-source-input',
    ])

    const midiEvt = { pitch: 60, velocity: 0.8 }
    midiNoteOn.subs[0]?.(midiEvt)
    midiNoteOff.subs[0]?.(midiEvt)
    midiPedal.subs[0]?.(true)
    midiPedal.subs[0]?.(false)
    keyNoteOn.subs[0]?.(midiEvt)
    keyNoteOff.subs[0]?.(midiEvt)
    keyPedal.subs[0]?.(true)
    keyPedal.subs[0]?.(false)
    keyOctave.subs[0]?.(2)
    busNoteOn.subs[0]?.(midiEvt)
    busNoteOff.subs[0]?.(midiEvt)
    performanceOn[0]?.(midiEvt)
    performanceOff[0]?.(midiEvt)
    performanceOff[1]?.({ pitch: 60, velocity: 0, clockTime: -1 })
    canvasPointerHandlers.get('pointerdown')?.({
      clientX: 10,
      clientY: 0,
      target: { setPointerCapture: vi.fn() },
      pointerId: 1,
      preventDefault: vi.fn(),
    })
    canvasPointerHandlers.get('pointermove')?.({ clientX: 11, clientY: 0 })
    canvasPointerHandlers.get('pointerup')?.()

    expect(inputBus.emitNoteOn).toHaveBeenNthCalledWith(1, midiEvt, 'midi')
    expect(inputBus.emitNoteOn).toHaveBeenNthCalledWith(2, midiEvt, 'keyboard')
    expect(inputBus.emitNoteOn).toHaveBeenNthCalledWith(
      3,
      { pitch: 60, velocity: 0.8, clockTime: 42 },
      'touch',
    )
    expect(inputBus.emitNoteOn).toHaveBeenNthCalledWith(
      4,
      { pitch: 62, velocity: 0.8, clockTime: 42 },
      'touch',
    )
    expect(inputBus.emitNoteOff).toHaveBeenNthCalledWith(1, midiEvt, 'midi')
    expect(inputBus.emitNoteOff).toHaveBeenNthCalledWith(2, midiEvt, 'keyboard')
    expect(inputBus.emitNoteOff).toHaveBeenNthCalledWith(
      3,
      { pitch: 60, velocity: 0, clockTime: 42 },
      'touch',
    )
    expect(inputBus.emitNoteOff).toHaveBeenNthCalledWith(
      4,
      { pitch: 62, velocity: 0, clockTime: 42 },
      'touch',
    )
    expect(inputBus.emitPedal).toHaveBeenNthCalledWith(1, true, 'midi')
    expect(inputBus.emitPedal).toHaveBeenNthCalledWith(2, false, 'midi')
    expect(inputBus.emitPedal).toHaveBeenNthCalledWith(3, true, 'keyboard')
    expect(inputBus.emitPedal).toHaveBeenNthCalledWith(4, false, 'keyboard')
    expect(onPedalUsed).toHaveBeenCalledTimes(2)
    expect(onPedalUsed).toHaveBeenNthCalledWith(1, 'midi')
    expect(onPedalUsed).toHaveBeenNthCalledWith(2, 'keyboard')
    expect(ui.syncOctave).toHaveBeenCalledWith(2)
    expect(onLiveNoteOn).toHaveBeenCalledWith(midiEvt)
    expect(onLiveNoteOff).toHaveBeenCalledWith(midiEvt)
    expect(synth.liveNoteOn).toHaveBeenCalledWith(60, 0.8)
    expect(synth.liveNoteOff).toHaveBeenCalledWith(60)
    expect(liveNotes.press).toHaveBeenCalledWith(60, 0.8, undefined)
    expect(capture.captureNoteOff).toHaveBeenCalledWith(60, 42)

    groups.flatMap((group) => group.unsubs).forEach((unsub) => unsub())

    expect(canvasPointerHandlers.has('pointerdown')).toBe(true)
    expect(canvasPointerHandlers.has('pointermove')).toBe(true)
    expect(canvasPointerHandlers.has('pointerup')).toBe(true)

    midiNoteOn.subs[0]?.(midiEvt)
    busNoteOn.subs[0]?.(midiEvt)

    expect(inputBus.emitNoteOn).toHaveBeenCalledTimes(4)
    expect(onLiveNoteOn).toHaveBeenCalledTimes(1)
  })
})
