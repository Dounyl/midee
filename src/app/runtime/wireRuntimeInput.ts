import type { BusNoteEvent, InputBus } from '@/services/input/InputBus'
import type { CaptureFanout } from '@/services/midi/CaptureFanout'
import type { ComputerKeyboardInput } from '@/services/midi/ComputerKeyboardInput'
import type { MidiInputManager } from '@/services/midi/MidiInputManager'
import type { LiveNoteStore } from '@/services/midi/LiveNoteStore'
import type { LivePerformanceBus } from '@/services/performance/LivePerformanceBus'
import type { SynthEngine } from '@/services/audio/SynthEngine'

export interface RuntimeSubscriptionGroup {
  label: string
  unsubs: Array<() => void>
}

export interface WireRuntimeInputMidiOptions {
  input: MidiInputManager
}

export interface WireRuntimeInputKeyboardOptions {
  input: ComputerKeyboardInput
  syncOctave(octave: number): void
}

export interface WireRuntimeInputTouchOptions {
  canvas: Pick<HTMLCanvasElement, 'addEventListener' | 'removeEventListener'>
  getCurrentTime(): number
  getStatus(): 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'exporting'
  resolvePitch(clientX: number, clientY: number): number | null
  primeInteractiveAudio(): void
}

export interface WireRuntimeInputBridgeOptions {
  inputBus: InputBus
  performanceBus: LivePerformanceBus
  synth: SynthEngine
  liveNotes: LiveNoteStore
  capture: CaptureFanout
  getCurrentTime(): number
  shouldCapturePerformance(): boolean
  onPedalUsed(source: 'midi' | 'keyboard'): void
  onLiveNoteOn(evt: BusNoteEvent): void
  onLiveNoteOff(evt: BusNoteEvent): void
}

export interface WireRuntimeInputOptions {
  midi: WireRuntimeInputMidiOptions
  keyboard: WireRuntimeInputKeyboardOptions
  touch: WireRuntimeInputTouchOptions
  bridge: WireRuntimeInputBridgeOptions
}

function wireMidiSource(options: WireRuntimeInputOptions): Array<() => void> {
  return [
    options.midi.input.noteOn.subscribe((evt) => {
      if (evt) options.bridge.inputBus.emitNoteOn(evt, 'midi')
    }),
    options.midi.input.noteOff.subscribe((evt) => {
      if (evt) options.bridge.inputBus.emitNoteOff(evt, 'midi')
    }),
    options.midi.input.pedal.subscribe((down) => {
      options.bridge.inputBus.emitPedal(down, 'midi')
      if (down) {
        options.bridge.performanceBus.routePedalDown('midi')
        options.bridge.onPedalUsed('midi')
      } else {
        options.bridge.performanceBus.routePedalUp('midi')
      }
    }),
  ]
}

function wireKeyboardSource(options: WireRuntimeInputOptions): Array<() => void> {
  return [
    options.keyboard.input.noteOn.subscribe((evt) => {
      if (evt) options.bridge.inputBus.emitNoteOn(evt, 'keyboard')
    }),
    options.keyboard.input.noteOff.subscribe((evt) => {
      if (evt) options.bridge.inputBus.emitNoteOff(evt, 'keyboard')
    }),
    options.keyboard.input.pedal.subscribe((down) => {
      options.bridge.inputBus.emitPedal(down, 'keyboard')
      if (down) {
        options.bridge.performanceBus.routePedalDown('keyboard')
        options.bridge.onPedalUsed('keyboard')
      } else {
        options.bridge.performanceBus.routePedalUp('keyboard')
      }
    }),
    options.keyboard.input.octave.subscribe((octave) => options.keyboard.syncOctave(octave)),
  ]
}

function wirePerformanceBridge(options: WireRuntimeInputOptions): Array<() => void> {
  return [
    options.bridge.inputBus.noteOn.subscribe((evt) => {
      if (evt) options.bridge.onLiveNoteOn(evt)
    }),
    options.bridge.inputBus.noteOff.subscribe((evt) => {
      if (evt) options.bridge.onLiveNoteOff(evt)
    }),
    options.bridge.performanceBus.subscribeNotes(
      (evt) => {
        options.bridge.synth.liveNoteOn(evt.pitch, evt.velocity)
        options.bridge.liveNotes.press(evt.pitch, evt.velocity, evt.clockTime)
      },
      (evt) => {
        options.bridge.synth.liveNoteOff(evt.pitch)
      },
    ),
    options.bridge.performanceBus.subscribeNotes(
      () => {},
      (evt) => {
        if (!options.bridge.shouldCapturePerformance()) return
        const time = evt.clockTime >= 0 ? evt.clockTime : options.bridge.getCurrentTime()
        options.bridge.capture.captureNoteOff(evt.pitch, time)
      },
    ),
  ]
}

function wireTouchSource(options: WireRuntimeInputOptions): Array<() => void> {
  let activeTouchPitch: number | null = null

  const onPointerDown = (event: PointerEvent): void => {
    if (options.touch.getStatus() === 'exporting') return
    const pitch = options.touch.resolvePitch(event.clientX, event.clientY)
    if (pitch === null) return

    options.touch.primeInteractiveAudio()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    event.preventDefault()

    if (activeTouchPitch !== null) {
      options.bridge.inputBus.emitNoteOff(
        { pitch: activeTouchPitch, velocity: 0, clockTime: options.touch.getCurrentTime() },
        'touch',
      )
    }
    activeTouchPitch = pitch
    options.bridge.inputBus.emitNoteOn(
      { pitch, velocity: 0.8, clockTime: options.touch.getCurrentTime() },
      'touch',
    )
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (activeTouchPitch === null) return
    if (options.touch.getStatus() === 'exporting') return
    const pitch = options.touch.resolvePitch(event.clientX, event.clientY)
    if (pitch === null || pitch === activeTouchPitch) return
    const previousPitch = activeTouchPitch
    activeTouchPitch = pitch
    options.bridge.inputBus.emitNoteOff(
      { pitch: previousPitch, velocity: 0, clockTime: options.touch.getCurrentTime() },
      'touch',
    )
    options.bridge.inputBus.emitNoteOn(
      { pitch, velocity: 0.8, clockTime: options.touch.getCurrentTime() },
      'touch',
    )
  }

  const onPointerUp = (): void => {
    if (activeTouchPitch === null) return
    const pitch = activeTouchPitch
    activeTouchPitch = null
    options.bridge.inputBus.emitNoteOff(
      { pitch, velocity: 0, clockTime: options.touch.getCurrentTime() },
      'touch',
    )
  }

  options.touch.canvas.addEventListener('pointerdown', onPointerDown)
  options.touch.canvas.addEventListener('pointermove', onPointerMove)
  options.touch.canvas.addEventListener('pointerup', onPointerUp)
  options.touch.canvas.addEventListener('pointercancel', onPointerUp)
  options.touch.canvas.addEventListener('pointerleave', onPointerUp)

  return [
    () => options.touch.canvas.removeEventListener('pointerdown', onPointerDown),
    () => options.touch.canvas.removeEventListener('pointermove', onPointerMove),
    () => options.touch.canvas.removeEventListener('pointerup', onPointerUp),
    () => options.touch.canvas.removeEventListener('pointercancel', onPointerUp),
    () => options.touch.canvas.removeEventListener('pointerleave', onPointerUp),
  ]
}

export function wireRuntimeInput(options: WireRuntimeInputOptions): RuntimeSubscriptionGroup[] {
  return [
    { label: 'midi-source-input', unsubs: wireMidiSource(options) },
    { label: 'keyboard-source-input', unsubs: wireKeyboardSource(options) },
    { label: 'performance-bridge-input', unsubs: wirePerformanceBridge(options) },
    { label: 'touch-source-input', unsubs: wireTouchSource(options) },
  ]
}
