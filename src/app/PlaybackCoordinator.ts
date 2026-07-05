import type { BusNoteEvent } from '../core/input/InputBus'
import type { LivePerformanceBus } from '../core/performance/LivePerformanceBus'
import type { LiveLooper, LiveLooperState } from '../midi/LiveLooper'
import type { LiveNoteStore } from '../midi/LiveNoteStore'
import type { SessionRecorder } from '../midi/SessionRecorder'
import { MODE_CAPTURES_LIVE } from '../modes/ModeController'
import { getCurrentRouteMode } from '../routing/routerBridge'
import { track, trackActivation } from '../telemetry'

interface PlaybackCoordinatorOptions {
  store: {
    state: {
      status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'exporting'
    }
    setState: (
      key: 'status',
      value: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'exporting',
    ) => void
  }
  clock: {
    currentTime: number
    play(): void
    pause(): void
    seek(value: number): void
  }
  synth: {
    liveNoteOn(pitch: number, velocity: number): void
    liveNoteOff(pitch: number): void
    liveReleaseAll(): void
    scheduleNoteOn(pitch: number, velocity: number, ctxTime: number): void
    scheduleNoteOff(pitch: number, ctxTime: number): void
    audioContextTime: number
    pause(): void
    seek(value: number): void
  }
  renderer: {
    burstParticleAt(pitch: number): void
  }
  liveNotes: LiveNoteStore
  loopNotes: LiveNoteStore
  liveLooper: LiveLooper
  sessionRec: SessionRecorder
  metronome: {
    stop(): void
  }
  capture: {
    captureNoteOn(pitch: number, velocity: number, clockTime: number): void
    captureNoteOff(pitch: number, clockTime: number): void
  }
  performanceBus: LivePerformanceBus
  enterLiveMode: (primeAudio?: boolean) => void
  closeTransientOverlays: () => void
}

export class PlaybackCoordinator {
  private firstLiveNoteLogged = false
  private loopArmedLogged = false
  private loopRecordedLogged = false
  private prevLooperState: LiveLooperState = 'idle'

  constructor(private readonly opts: PlaybackCoordinatorOptions) {}

  private currentPageMode(): 'home' | 'play' | 'live' | 'learn' {
    return getCurrentRouteMode() ?? 'home'
  }

  releaseAllLiveNotes(): void {
    const now = this.opts.clock.currentTime
    this.opts.liveNotes.releaseAll(now)
    this.opts.synth.liveReleaseAll()
    this.opts.performanceBus.forceReleaseAll(now)
  }

  resetInteractionState(): void {
    this.opts.clock.pause()
    this.opts.clock.seek(0)
    this.opts.synth.pause()
    this.opts.synth.seek(0)
    this.opts.liveNotes.reset()
    this.opts.loopNotes.reset()
    this.opts.liveLooper.clear()
    this.opts.sessionRec.cancel()
    this.opts.metronome.stop()
    this.opts.synth.liveReleaseAll()
    this.opts.closeTransientOverlays()
  }

  trackLoopTransition(next: LiveLooperState): void {
    const prev = this.prevLooperState
    this.prevLooperState = next
    if (!this.loopArmedLogged && (next === 'armed' || next === 'recording')) {
      this.loopArmedLogged = true
      track('loop_armed')
    }
    if (!this.loopRecordedLogged && next === 'playing' && prev === 'recording') {
      this.loopRecordedLogged = true
      track('loop_recorded', { layers: this.opts.liveLooper.layerCount.value })
    }
    if (next === 'playing' && prev === 'overdubbing') {
      track('loop_layer_added', { layers: this.opts.liveLooper.layerCount.value })
    }
  }

  handleLiveNoteOn(evt: BusNoteEvent): void {
    if (this.opts.store.state.status === 'exporting') return
    const mode = this.currentPageMode()
    const captures = MODE_CAPTURES_LIVE[mode]
    if (mode === 'home') this.opts.enterLiveMode(false)

    if (!this.firstLiveNoteLogged) {
      this.firstLiveNoteLogged = true
      track('first_live_note', { source: evt.source })
      trackActivation('live_note')
    }

    this.opts.performanceBus.routeNoteOn(evt)

    if (captures) {
      this.opts.renderer.burstParticleAt(evt.pitch)
      this.opts.capture.captureNoteOn(evt.pitch, evt.velocity, evt.clockTime)
    }

    if (mode === 'live') {
      const status = this.opts.store.state.status
      if (status === 'idle' || status === 'ready' || status === 'paused') {
        this.opts.clock.play()
        this.opts.store.setState('status', 'playing')
      }
    }
  }

  handleLiveNoteOff(evt: BusNoteEvent): void {
    const mode = this.currentPageMode()
    if (mode === 'home') return
    this.opts.liveNotes.release(evt.pitch, evt.clockTime)
    this.opts.performanceBus.routeNoteOff(evt)
  }

  deferToCtxTime(ctxTime: number, fn: () => void): void {
    const ctxNow = this.opts.synth.audioContextTime
    const delayMs = Math.max(0, (ctxTime - ctxNow) * 1000)
    if (delayMs < 2) {
      fn()
      return
    }
    setTimeout(fn, delayMs)
  }
}
