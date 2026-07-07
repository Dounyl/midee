import type { MasterClock } from '@/lib/core/MasterClock'
import type { Metronome } from '@/services/audio/Metronome'
import type { InstrumentId } from '@/services/audio/instruments'
import type { SynthEngine } from '@/services/audio/SynthEngine'
import type { LiveLooper, LiveLooperState } from '@/services/midi/LiveLooper'
import type { MidiInputManager } from '@/services/midi/MidiInputManager'
import type { SessionRecorder } from '@/services/midi/SessionRecorder'
import type { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import { categorizeMidiDevice, track, trackActivation } from '@/services/telemetry'
import type { AppStore } from '@/stores/app/state'
import { watch } from '@/stores/app/watch'
import { subscribeCurrentRoute } from '@/stores/routing/routerBridge'
import { isPlayRouteTarget, type RouteTarget } from '@/stores/routing/routeTarget'

export interface RuntimeSubscriptionGroup {
  label: string
  unsubs: Array<() => void>
}

export interface WireRuntimeEffectsOptions {
  route: {
    currentTarget(): RouteTarget | null
    currentTelemetryMode(): string
    syncConsolePanel(): void
    applyChordOverlayVisibility(): void
    handleLoadedMidiChange(): void
  }
  playback: {
    store: AppStore
    clock: MasterClock
    synth: SynthEngine
    liveLooper: LiveLooper
    metronome: Metronome
    sessionRec: SessionRecorder
    onTrackLoopTransition(next: LiveLooperState): void
    onResetLiveNotes(): void
    onMaybeUpdateChordOverlay(time: number): void
    onFirstPlaybackMilestone(seconds: number): void
    onSpeedChange(speed: number): void
    playbackMilestones: Set<number>
    firstPlayLoggedRef: { current: boolean }
    applyInstrumentLoading(id: InstrumentId | null): void
  }
  midi: {
    input: MidiInputManager
  }
  ui: RuntimeUiBridge
}

function wireRouteEffects(options: WireRuntimeEffectsOptions): RuntimeSubscriptionGroup {
  return {
    label: 'route-sync-effects',
    unsubs: [
      subscribeCurrentRoute(() => {
        options.route.applyChordOverlayVisibility()
        options.route.syncConsolePanel()
      }),
    ],
  }
}

function wirePlaybackEffects(options: WireRuntimeEffectsOptions): RuntimeSubscriptionGroup[] {
  const pushLoop = (): void =>
    options.ui.syncLoopState(
      options.playback.liveLooper.state.value,
      options.playback.liveLooper.layerCount.value,
    )
  const pushMetronome = (): void =>
    options.ui.syncMetronome(
      options.playback.metronome.running.value,
      options.playback.metronome.bpm.value,
    )
  const pushSession = (): void =>
    options.ui.syncSessionRecording(
      options.playback.sessionRec.recording.value,
      options.playback.sessionRec.elapsed.value,
    )

  return [
    {
      label: 'loop-ui-sync',
      unsubs: [
        options.playback.liveLooper.state.subscribe((s) => {
          options.playback.onTrackLoopTransition(s)
          pushLoop()
        }),
        options.playback.liveLooper.layerCount.subscribe(pushLoop),
      ],
    },
    {
      label: 'metronome-ui-sync',
      unsubs: [
        options.playback.metronome.running.subscribe(pushMetronome),
        options.playback.metronome.bpm.subscribe(pushMetronome),
        options.playback.metronome.beatCount.subscribe((count) => {
          if (count === 0) return
          options.ui.pulseMetronomeBeat((count - 1) % 4 === 0)
        }),
      ],
    },
    {
      label: 'session-ui-sync',
      unsubs: [
        options.playback.sessionRec.recording.subscribe(pushSession),
        options.playback.sessionRec.elapsed.subscribe(pushSession),
        options.playback.liveLooper.progress.subscribe((p) => options.ui.syncLoopProgress(p)),
      ],
    },
    {
      label: 'instrument-loading-sync',
      unsubs: [
        options.playback.synth.loadingInstrument.subscribe((id) => {
          options.playback.applyInstrumentLoading(id)
        }),
      ],
    },
  ]
}

function wireSessionEffects(options: WireRuntimeEffectsOptions): RuntimeSubscriptionGroup[] {
  return [
    {
      label: 'clock-effects',
      unsubs: [
        options.playback.clock.subscribe((t) => {
          for (const m of [30, 60, 120]) {
            if (t >= m && !options.playback.playbackMilestones.has(m)) {
              options.playback.playbackMilestones.add(m)
              const routeTarget = options.route.currentTarget()
              track('playback_milestone', {
                seconds: m,
                mode: options.route.currentTelemetryMode(),
                route_kind: routeTarget?.kind ?? 'play',
              })
              if (m === 30) trackActivation('playback_30s')
              options.playback.onFirstPlaybackMilestone(m)
            }
          }
          options.playback.onMaybeUpdateChordOverlay(t)
        }),
      ],
    },
    {
      label: 'store-watchers',
      unsubs: [
        watch(
          () => options.playback.store.state.status,
          (status) => {
            options.route.syncConsolePanel()
            options.route.applyChordOverlayVisibility()
            const routeTarget = options.route.currentTarget()
            if (isPlayRouteTarget(routeTarget) && status === 'playing') {
              void options.playback.synth.play(options.playback.clock.currentTime)
              if (!options.playback.firstPlayLoggedRef.current) {
                options.playback.firstPlayLoggedRef.current = true
                const midi = options.playback.store.state.loadedMidi
                track('first_play', {
                  mode: options.route.currentTelemetryMode(),
                  route_kind: routeTarget?.kind ?? 'play',
                  duration_s: midi ? Math.round(midi.duration) : null,
                })
              }
            } else if (status === 'paused') {
              options.playback.synth.pause()
              if (routeTarget?.kind === 'live') options.playback.onResetLiveNotes()
            }
          },
        ),
        watch(
          () => options.playback.store.state.loadedMidi,
          () => options.route.handleLoadedMidiChange(),
        ),
        watch(
          () => options.playback.store.state.volume,
          (v) => options.playback.synth.setVolume(v),
        ),
        watch(
          () => options.playback.store.state.speed,
          (s) => options.playback.onSpeedChange(s),
        ),
      ],
    },
  ]
}

function wireMidiEffects(options: WireRuntimeEffectsOptions): RuntimeSubscriptionGroup {
  return {
    label: 'midi-status-watchers',
    unsubs: [
      options.midi.input.status.subscribe((status) => {
        options.ui.syncMidiStatus(status, options.midi.input.deviceName.value)
        if (status === 'connected') {
          track('midi_device_connected', {
            vendor: categorizeMidiDevice(options.midi.input.deviceName.value),
          })
        }
      }),
      options.midi.input.deviceName.subscribe((name) => {
        options.ui.syncMidiStatus(options.midi.input.status.value, name)
      }),
    ],
  }
}

export function wireRuntimeEffects(options: WireRuntimeEffectsOptions): RuntimeSubscriptionGroup[] {
  return [
    wireRouteEffects(options),
    ...wirePlaybackEffects(options),
    ...wireSessionEffects(options),
    wireMidiEffects(options),
  ]
}
