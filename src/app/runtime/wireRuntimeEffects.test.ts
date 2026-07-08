import { describe, expect, it, vi } from 'vitest'
import { wireRuntimeEffects } from '@/app/runtime/wireRuntimeEffects'
import type { RouteTarget } from '@/stores/routing/routeTarget'

function createSignalMock<T>(initial: T) {
  const subs: Array<(value: T) => void> = []
  return {
    value: initial,
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

vi.mock('@/services/telemetry', () => ({
  categorizeMidiDevice: vi.fn(() => 'digital-piano'),
  track: vi.fn(),
  trackActivation: vi.fn(),
}))

vi.mock('@/stores/routing/routerBridge', () => ({
  subscribeCurrentRoute: vi.fn((fn: () => void) => {
    ;(globalThis as { __routeSub?: () => void }).__routeSub = fn
    return vi.fn()
  }),
}))

vi.mock('@/stores/app/watch', () => ({
  watch: vi.fn((_read: () => unknown, fn: (value: unknown) => void) => {
    let active = true
    const cleanup = ((value?: unknown) => {
      if (!active) return
      fn(value)
    }) as ((value?: unknown) => void) & { dispose?: () => void }
    cleanup.dispose = () => {
      active = false
    }
    return cleanup
  }),
}))

describe('wireRuntimeEffects', () => {
  it('returns grouped effect subscriptions and wires route/midi sync handlers', async () => {
    const applyChordOverlayVisibility = vi.fn()
    const applyInstrumentLoading = vi.fn()
    const ui = {
      syncLoopState: vi.fn(),
      syncMetronome: vi.fn(),
      syncSessionRecording: vi.fn(),
      syncLoopProgress: vi.fn(),
      pulseMetronomeBeat: vi.fn(),
      syncMidiStatus: vi.fn(),
    }
    const liveLooperState = createSignalMock<'idle' | 'playing'>('idle')
    const liveLooperLayers = createSignalMock(0)
    const metronomeRunning = createSignalMock(false)
    const metronomeBpm = createSignalMock(120)
    const metronomeBeat = createSignalMock(0)
    const sessionRecording = createSignalMock(false)
    const sessionElapsed = createSignalMock(0)
    const loopProgress = createSignalMock(0)
    const instrumentLoading = createSignalMock<string | null>(null)
    const midiStatus = createSignalMock<'idle' | 'connected'>('idle')
    const midiName = createSignalMock('P-125')

    const groups = wireRuntimeEffects({
      ui: ui as never,
      route: {
        currentTarget: vi.fn<() => RouteTarget | null>(() => ({ kind: 'play' })),
        currentTelemetryMode: vi.fn(() => 'play'),
        syncConsolePanel: vi.fn(),
        applyChordOverlayVisibility,
        handleLoadedMidiChange: vi.fn(),
      },
      playback: {
        store: { state: { loadedMidi: null } } as never,
        clock: { currentTime: 0, subscribe: vi.fn(() => vi.fn()) } as never,
        synth: {
          play: vi.fn(),
          pause: vi.fn(),
          setVolume: vi.fn(),
          loadingInstrument: instrumentLoading,
        } as never,
        liveLooper: {
          state: liveLooperState,
          layerCount: liveLooperLayers,
          progress: loopProgress,
        } as never,
        metronome: {
          running: metronomeRunning,
          bpm: metronomeBpm,
          beatCount: metronomeBeat,
        } as never,
        sessionRec: {
          recording: sessionRecording,
          elapsed: sessionElapsed,
        } as never,
        onTrackLoopTransition: vi.fn(),
        onResetLiveNotes: vi.fn(),
        onMaybeUpdateChordOverlay: vi.fn(),
        onFirstPlaybackMilestone: vi.fn(),
        onSpeedChange: vi.fn(),
        playbackMilestones: new Set<number>(),
        firstPlayLoggedRef: { current: false },
        applyInstrumentLoading,
      },
      midi: {
        input: {
          status: midiStatus,
          deviceName: midiName,
        } as never,
      },
    })

    expect(groups.map((group) => group.label)).toEqual([
      'route-sync-effects',
      'loop-ui-sync',
      'metronome-ui-sync',
      'session-ui-sync',
      'instrument-loading-sync',
      'clock-effects',
      'store-watchers',
      'midi-status-watchers',
    ])

    ;(globalThis as { __routeSub?: () => void }).__routeSub?.()
    expect(groups[0]?.label).toBe('route-sync-effects')

    liveLooperState.subs[0]?.('playing')
    liveLooperLayers.subs[0]?.(2)
    metronomeRunning.subs[0]?.(true)
    metronomeBpm.subs[0]?.(132)
    metronomeBeat.subs[0]?.(4)
    sessionRecording.subs[0]?.(true)
    sessionElapsed.subs[0]?.(3)
    loopProgress.subs[0]?.(0.5)
    instrumentLoading.subs[0]?.('felt-piano')
    midiStatus.subs[0]?.('connected')
    midiName.subs[0]?.('P-125')

    expect(ui.syncLoopState).toHaveBeenCalled()
    expect(ui.syncMetronome).toHaveBeenCalled()
    expect(ui.pulseMetronomeBeat).toHaveBeenCalledWith(false)
    expect(ui.syncSessionRecording).toHaveBeenCalled()
    expect(ui.syncLoopProgress).toHaveBeenCalledWith(0.5)
    expect(applyInstrumentLoading).toHaveBeenCalledWith('felt-piano')
    expect(ui.syncMidiStatus).toHaveBeenCalledWith('connected', 'P-125')
    expect(ui.syncMidiStatus).toHaveBeenCalledWith('idle', 'P-125')
    expect(applyChordOverlayVisibility).toHaveBeenCalledTimes(1)

    groups
      .flatMap((group) => group.unsubs)
      .forEach((unsub) => {
        ;(unsub as { dispose?: () => void }).dispose?.()
        unsub()
      })

    liveLooperState.subs[0]?.('idle')
    instrumentLoading.subs[0]?.('piano')
    midiStatus.subs[0]?.('connected')

    expect(ui.syncLoopState).toHaveBeenCalledTimes(2)
    expect(applyInstrumentLoading).toHaveBeenCalledTimes(1)
    expect(ui.syncMidiStatus).toHaveBeenCalledTimes(2)
  })
})
