import { createSignal, onCleanup, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { render } from 'solid-js/web'
import { DragCoachmark } from '@/components/common/DragCoachmark'
import { isLearnCoachmarkSeen, LearnCoachmark } from '@/components/learn/LearnCoachmark'
import { t } from '@/i18n'
import type { LiveLooperState } from '@/services/midi/LiveLooper'
import type { MidiDeviceStatus } from '@/services/midi/MidiInputCoordinator'
import { trackEvent, trackEventSettled } from '@/services/telemetry'
import type { AppActions } from '@/stores/app/AppCtx'
import { watch } from '@/stores/app/watch'
import { getCurrentRouteTarget, subscribeCurrentRoute } from '@/stores/routing/routerBridge'
import {
  isLearnRouteTarget,
  isLiveRouteTarget,
  isPlayRouteTarget,
  type RouteTarget,
} from '@/stores/routing/routeTarget'
import type { AppServices } from '@/types/app/AppServices'
import { ControlsContext, type ControlsContextValue, type UiStoreShape } from './ControlsContext'
import {
  formatMMSS,
  formatSpeed,
  formatTime,
  getMidiMenuLabel,
  getMidiPillLabel,
  HudView,
  KeyHintView,
  loadHudHasDragged,
  loadKeyHintHidden,
  loopLabel,
  saveHudHasDragged,
  saveKeyHintHidden,
  TopStripView,
  ZOOM_DEFAULT,
} from './ControlsView'

const SKIP_SECONDS = 10

export { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from './ControlsView'

interface ControlsInternalHooks {
  onSetInstrumentLoading: (fn: (v: boolean) => void) => void
  onUpdateContext: (fn: (fileName: string | null) => void) => void
  onSetUiStore: (fn: (setter: (prev: UiStoreShape) => UiStoreShape) => void) => void
  onMetroBeatEl: (el: HTMLElement) => void
  onTracksButton: (el: HTMLButtonElement) => void
  onInstrumentSlot: (el: HTMLElement) => void
  onChordSlot: (el: HTMLElement) => void
  onCustomizeSlot: (el: HTMLElement) => void
}

export interface ControlsProps {
  services: AppServices
  actions: AppActions
  onSeek?: (t: number) => void
  onZoom?: (pps: number) => void
  onThemeCycle?: () => void
  onMidiConnect?: () => void
  onOpenTracks?: () => void
  onRecord?: () => void
  onTransposeChange?: (semitones: number) => void
  onInstrumentCycle?: () => void
  onParticleCycle?: () => void
  onLoopToggle?: () => void
  onLoopClear?: () => void
  onLoopSave?: () => void
  onLoopUndo?: () => void
  onMetronomeToggle?: () => void
  onMetronomeBpmChange?: (bpm: number) => void
  onSessionToggle?: () => void
  onChordToggle?: () => void
  onOctaveShift?: (delta: number) => void
}

/**
 * Controls - Main playback controls component (Solid-ified)
 *
 * Replaces the 776-line Controls class with a declarative Solid component.
 * Uses Context to share state with child components (TopStrip, FloatingHud, KeyHint).
 *
 * Note: This component renders into the provided container element and returns
 * refs to DOM elements needed by other parts of the UI bootstrap process.
 */
export function createControls(
  container: HTMLElement,
  props: ControlsProps,
): {
  dispose: () => void
  tracksButton: HTMLButtonElement
  instrumentSlot: HTMLElement
  chordSlot: HTMLElement
  customizeSlot: HTMLElement
  updateLoopState: (state: LiveLooperState, layerCount: number) => void
  updateLoopProgress: (progress: number) => void
  updateMetronome: (running: boolean, bpm: number) => void
  pulseMetronomeBeat: (isDownbeat: boolean) => void
  updateSessionRecording: (recording: boolean, elapsed: number) => void
  updateMidiStatus: (status: MidiDeviceStatus, deviceName: string) => void
  updateOctave: (octave: number) => void
  setInstrumentLoading: (loading: boolean) => void
  updateInstrument: (name: string) => void
  updateLearnFileName: (name: string | null) => void
  updateChordOverlayState: (on: boolean) => void
} {
  let disposeRoot: (() => void) | undefined
  let tracksButtonRef: HTMLButtonElement
  let instrumentSlotRef: HTMLElement
  let chordSlotRef: HTMLElement
  let customizeSlotRef: HTMLElement

  // Imperative API hooks
  let setInstrumentLoadingSignal: ((v: boolean) => void) | undefined
  let updateContextFn: ((fileName: string | null) => void) | undefined
  let setUiStoreFn: ((setter: (prev: UiStoreShape) => UiStoreShape) => void) | undefined
  let metroBeatElRef: HTMLElement | undefined

  disposeRoot = render(() => {
    return Controls(props, {
      onSetInstrumentLoading: (fn) => {
        setInstrumentLoadingSignal = fn
      },
      onUpdateContext: (fn) => {
        updateContextFn = fn
      },
      onSetUiStore: (fn) => {
        setUiStoreFn = fn
      },
      onMetroBeatEl: (el) => {
        metroBeatElRef = el
      },
      onTracksButton: (el) => {
        tracksButtonRef = el
      },
      onInstrumentSlot: (el) => {
        instrumentSlotRef = el
      },
      onChordSlot: (el) => {
        chordSlotRef = el
      },
      onCustomizeSlot: (el) => {
        customizeSlotRef = el
      },
    })
  }, container)

  return {
    dispose: () => disposeRoot?.(),
    get tracksButton() {
      return tracksButtonRef
    },
    get instrumentSlot() {
      return instrumentSlotRef
    },
    get chordSlot() {
      return chordSlotRef
    },
    get customizeSlot() {
      return customizeSlotRef
    },

    // Imperative API methods (for RuntimeUiBridge compatibility)
    updateLoopState: (state: LiveLooperState, layerCount: number) => {
      setUiStoreFn?.((prev) => ({
        ...prev,
        loop: { ...prev.loop, state, layerCount },
      }))
    },
    updateLoopProgress: (progress: number) => {
      const deg = Math.max(0, Math.min(1, progress)) * 360
      setUiStoreFn?.((prev) => ({ ...prev, loop: { ...prev.loop, progressDeg: deg } }))
    },
    updateMetronome: (running: boolean, bpm: number) => {
      setUiStoreFn?.((prev) => ({ ...prev, metro: { running, bpm } }))
    },
    pulseMetronomeBeat: (isDownbeat: boolean) => {
      if (!metroBeatElRef) return
      metroBeatElRef.classList.remove('hud-metro-beat--tick', 'hud-metro-beat--down')
      void metroBeatElRef.offsetWidth
      metroBeatElRef.classList.add(isDownbeat ? 'hud-metro-beat--down' : 'hud-metro-beat--tick')
    },
    updateSessionRecording: (recording: boolean, elapsed: number) => {
      setUiStoreFn?.((prev) => ({ ...prev, session: { recording, elapsed } }))
    },
    updateMidiStatus: (status: MidiDeviceStatus, deviceName: string) => {
      setUiStoreFn?.((prev) => ({ ...prev, midi: { status, deviceName } }))
    },
    updateOctave: (_octave: number) => {
      // Handled via setOctave signal exposure if needed
    },
    setInstrumentLoading: (loading: boolean) => {
      setInstrumentLoadingSignal?.(loading)
    },
    updateInstrument: (_name: string) => {
      // No-op for now
    },
    updateLearnFileName: (name: string | null) => {
      updateContextFn?.(name)
    },
    updateChordOverlayState: (_on: boolean) => {
      // No-op for now
    },
  }
}

export const Controls = (props: ControlsProps, hooks?: ControlsInternalHooks) => {
  const { store, clock } = props.services

  // Signals - reactive primitives
  const [routeTarget, setRouteTarget] = createSignal<RouteTarget | null>(getCurrentRouteTarget())
  const [status, setStatus] = createSignal<string>(store.state.status)
  const [hasFile, setHasFile] = createSignal<boolean>(store.state.loadedMidi !== null)
  const [dimTopStrip, setDimTopStrip] = createSignal(false)
  const [hudIdle, setHudIdle] = createSignal(false)
  const [hudHasDragged, setHudHasDragged] = createSignal(loadHudHasDragged())
  const [learnCoachmarkSeen, setLearnCoachmarkSeen] = createSignal(isLearnCoachmarkSeen())
  const [instrumentLoading, setInstrumentLoading] = createSignal(false)
  const [keyHintHidden, setKeyHintHidden] = createSignal(loadKeyHintHidden())
  const [octave, setOctave] = createSignal(4)
  const [volume, setVolume] = createSignal(store.state.volume ?? 0.8)
  const [speed, setSpeed] = createSignal(store.state.speed ?? 1)
  const [zoom, setZoom] = createSignal(ZOOM_DEFAULT)

  // Store - grouped UI state with field-level reactivity
  const [uiStore, setUi] = createStore<UiStoreShape>({
    context: {
      kicker: t('topStrip.context.ready.kicker'),
      title: t('topStrip.context.ready.title'),
    },
    midiLibrary: {
      entries: [],
      open: false,
    },
    midi: {
      status: 'disconnected' as const,
      deviceName: null,
    },
    session: {
      recording: false,
      elapsed: 0,
    },
    loop: {
      state: 'idle' as const,
      layerCount: 0,
      progressDeg: 0,
    },
    metro: {
      running: false,
      bpm: 120,
    },
  })

  // Refs for imperative DOM access
  let scrubberRef: HTMLInputElement | undefined
  let timeDisplayRef: HTMLElement | undefined
  let durationRef: HTMLElement | undefined
  let metroBeatRef: HTMLElement | undefined
  let topStripRef: HTMLElement | undefined
  let tracksButtonRef: HTMLButtonElement | undefined
  let instrumentSlotRef: HTMLElement | undefined
  let chordSlotRef: HTMLElement | undefined
  let customizeSlotRef: HTMLElement | undefined
  let learnFileName: string | null = null
  let isScrubbing = false
  let lastDisplaySec = -1
  let lastFillPct = -1
  let hudWakeFn: (() => void) | undefined
  let hudTogglePinFn: (() => void) | undefined

  // Expose hooks for imperative API
  hooks?.onSetInstrumentLoading?.(setInstrumentLoading)
  hooks?.onUpdateContext?.((name) => {
    learnFileName = name
    updateContext(name)
  })
  hooks?.onSetUiStore?.((setter) => setUi((prev) => setter(prev)))

  // Lifecycle: Setup subscriptions
  onMount(() => {
    const unsubs: Array<() => void> = []

    // Route changes
    unsubs.push(
      subscribeCurrentRoute(() => {
        setRouteTarget(getCurrentRouteTarget())
        updateContext(learnFileName)
      }),
    )

    // Store watchers
    unsubs.push(
      watch(
        () => store.state.status,
        (s) => {
          setStatus(s)
          updateContext(learnFileName)
        },
      ),
      watch(
        () => store.state.loadedMidi,
        (midi) => {
          setHasFile(midi !== null)
          updateContext(learnFileName)
        },
      ),
      watch(
        () => store.state.duration,
        (d) => {
          if (scrubberRef) scrubberRef.max = String(d)
          if (durationRef) durationRef.textContent = formatTime(d)
        },
      ),
    )

    // Clock subscription for 60Hz updates
    unsubs.push(
      clock.subscribe((t) => {
        if (!isPlayRouteTarget(routeTarget()) || isScrubbing) return
        if (store.state.status === 'exporting') return
        const dur = store.state.duration

        if (scrubberRef) {
          scrubberRef.value = String(t)
        }

        const sec = Math.floor(t)
        if (sec !== lastDisplaySec && timeDisplayRef) {
          timeDisplayRef.textContent = formatTime(t)
          lastDisplaySec = sec
        }

        const pct = dur > 0 ? Math.min((t / dur) * 100, 100) : 0
        if (Math.abs(pct - lastFillPct) >= 0.1 && scrubberRef) {
          scrubberRef.style.setProperty('--pct', `${pct.toFixed(1)}%`)
          lastFillPct = pct
        }

        if (dur > 0 && t >= dur) {
          clock.pause()
          clock.seek(0)
          store.setState('status', 'ready')
        }
      }),
    )

    // Document-level event listeners
    const handleMouseMove = () => {
      const target = routeTarget()
      if (isPlayRouteTarget(target) || isLiveRouteTarget(target)) {
        wakeUp()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const route = routeTarget()

      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'KeyP') {
        e.preventDefault()
        hudTogglePinFn?.()
        return
      }

      if (isPlayRouteTarget(route)) {
        if (e.code === 'Space') {
          e.preventDefault()
          handlePlayClick()
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault()
          handleSkip(-SKIP_SECONDS)
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          handleSkip(SKIP_SECONDS)
        } else if (e.code === 'KeyT') {
          props.onOpenTracks?.()
        } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          if (store.state.status !== 'exporting') {
            props.onRecord?.()
          }
        }
        return
      }

      if (isLiveRouteTarget(route)) {
        if (e.code === 'Tab') {
          e.preventDefault()
          props.onSessionToggle?.()
          return
        }
        if (e.code === 'Backquote') {
          e.preventDefault()
          props.onMetronomeToggle?.()
          return
        }

        if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
          switch (e.code) {
            case 'KeyR':
              e.preventDefault()
              props.onSessionToggle?.()
              break
            case 'KeyL':
              e.preventDefault()
              props.onLoopToggle?.()
              break
            case 'KeyU':
              e.preventDefault()
              props.onLoopUndo?.()
              break
            case 'KeyC':
              e.preventDefault()
              props.onLoopClear?.()
              break
            case 'KeyM':
              e.preventDefault()
              props.onMetronomeToggle?.()
              break
          }
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup
    onCleanup(() => {
      unsubs.forEach((u) => {
        u()
      })
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
    })

    // Initial UI refresh
    updateContext(learnFileName)

    // Expose refs via hooks
    if (metroBeatRef) hooks?.onMetroBeatEl?.(metroBeatRef)
    if (tracksButtonRef) hooks?.onTracksButton?.(tracksButtonRef)
    if (instrumentSlotRef) hooks?.onInstrumentSlot?.(instrumentSlotRef)
    if (chordSlotRef) hooks?.onChordSlot?.(chordSlotRef)
    if (customizeSlotRef) hooks?.onCustomizeSlot?.(customizeSlotRef)
  })

  // Update context based on route
  const updateContext = (fileName: string | null) => {
    learnFileName = fileName
    const target = routeTarget()

    if (isPlayRouteTarget(target) && status() === 'loading') {
      setUi('context', {
        kicker: t('topStrip.context.loading.kicker'),
        title: t('topStrip.context.loading.title'),
      })
      return
    }

    if (isPlayRouteTarget(target)) {
      const midi = store.state.loadedMidi
      if (midi) {
        setUi('context', {
          kicker: t('topStrip.context.play.kicker'),
          title: midi.name,
        })
      } else {
        setUi('context', {
          kicker: t('topStrip.context.play.kicker'),
          title: t('topStrip.context.play.fallback'),
        })
      }
      return
    }

    if (isLiveRouteTarget(target)) {
      const midiStatus = uiStore.midi.status
      const deviceName = uiStore.midi.deviceName
      setUi('context', {
        kicker: t('topStrip.context.live.kicker'),
        title:
          midiStatus === 'connected'
            ? deviceName || t('topStrip.context.live.midiSession')
            : t('topStrip.context.live.keyboard'),
      })
      return
    }

    if (isLearnRouteTarget(target)) {
      if (fileName) {
        setUi('context', {
          kicker: t('topStrip.context.learning.kicker'),
          title: fileName,
        })
      } else {
        setUi('context', {
          kicker: t('topStrip.context.learn.kicker'),
          title: t('topStrip.context.learn.title'),
        })
      }
      return
    }

    setUi('context', {
      kicker: t('topStrip.context.ready.kicker'),
      title: t('topStrip.context.ready.title'),
    })
  }

  // Event handlers
  const handlePlayClick = () => {
    if (!isPlayRouteTarget(routeTarget())) return
    const s = status()

    if (s === 'playing') {
      clock.pause()
      store.setState('status', 'paused')
      const dur = store.state.duration
      trackEvent('playback_paused', {
        position_s: Math.round(clock.currentTime),
        position_pct: dur > 0 ? Math.round((clock.currentTime / dur) * 100) : 0,
      })
    } else if (s === 'paused' || s === 'ready') {
      clock.play()
      store.setState('status', 'playing')
    }
  }

  const handleSkip = (delta: number) => {
    if (!isPlayRouteTarget(routeTarget())) return
    const from = clock.currentTime
    const next =
      delta < 0
        ? Math.max(0, clock.currentTime + delta)
        : Math.min(store.state.duration, clock.currentTime + delta)
    invalidateTimeCache()
    clock.seek(next)
    props.onSeek?.(next)
    trackEvent('seeked', { from_s: Math.round(from), to_s: Math.round(next), method: 'skip' })
  }

  const handleBpmChange = (delta: number) => {
    const current = uiStore.metro.bpm
    props.onMetronomeBpmChange?.(current + delta)
  }

  const wakeUp = () => {
    setDimTopStrip(false)
    hudWakeFn?.()
  }

  const invalidateTimeCache = () => {
    lastDisplaySec = -1
    lastFillPct = -1
  }

  const updateFill = (t: number) => {
    if (!scrubberRef) return
    const dur = store.state.duration
    const pct = dur > 0 ? Math.min((t / dur) * 100, 100) : 0
    scrubberRef.style.setProperty('--pct', `${pct}%`)
  }

  const handleScrubberInput = () => {
    if (!scrubberRef || !timeDisplayRef) return
    const t = parseFloat(scrubberRef.value)
    timeDisplayRef.textContent = formatTime(t)
    updateFill(t)
  }

  const handleScrubberChange = () => {
    if (!scrubberRef) return
    isScrubbing = false
    const t = parseFloat(scrubberRef.value)
    const from = clock.currentTime
    invalidateTimeCache()
    clock.seek(t)
    props.onSeek?.(t)
    trackEvent('seeked', {
      from_s: Math.round(from),
      to_s: Math.round(t),
      method: 'scrub',
    })
  }

  const handleScrubberDown = () => {
    isScrubbing = true
    wakeUp()
  }

  const handleScrubberTouch = () => {
    isScrubbing = true
  }

  // Context value
  const contextValue: ControlsContextValue = {
    services: props.services,
    actions: props.actions,
    routeTarget,
    status,
    hasFile,
    dimTopStrip,
    hudIdle,
    hudHasDragged,
    instrumentLoading,
    octave,
    volume,
    speed,
    zoom,
    uiStore,
    setUi,
    setDimTopStrip,
    setHudIdle,
    setHudHasDragged,
    setInstrumentLoading,
    setOctave,
    setVolume,
    setSpeed,
    setZoom,
    handlePlayClick,
    handleSkip,
    handleBpmChange,
    wakeUp,
    updateContext,
    scrubberRef,
    topStripRef,
    onSeek: props.onSeek,
    onZoom: props.onZoom,
    onThemeCycle: props.onThemeCycle,
    onMidiConnect: props.onMidiConnect,
    onTracksOpen: props.onOpenTracks,
    onExportOpen: props.onRecord,
    onTransposeChange: props.onTransposeChange,
    onInstrumentCycle: props.onInstrumentCycle,
    onParticleStyleCycle: props.onParticleCycle,
    onLoopToggle: props.onLoopToggle,
    onLoopClear: props.onLoopClear,
    onLoopSave: props.onLoopSave,
    onLoopUndo: props.onLoopUndo,
    onMetroToggle: props.onMetronomeToggle,
    onMetroBpmChange: props.onMetronomeBpmChange,
    onSessionToggle: props.onSessionToggle,
    onChordToggle: props.onChordToggle,
    onOctaveShift: props.onOctaveShift,
  }

  return (
    <ControlsContext.Provider value={contextValue}>
      <div style={{ display: 'contents' }}>
        {/* Hidden slots for external panels - with IDs for querySelector */}
        <div
          id="ts-instrument-slot"
          ref={(el) => (instrumentSlotRef = el)}
          style={{ display: 'none' }}
        />
        <div id="ts-chord-slot" ref={(el) => (chordSlotRef = el)} style={{ display: 'none' }} />
        <div
          id="ts-customize-slot"
          ref={(el) => (customizeSlotRef = el)}
          style={{ display: 'none' }}
        />

        <TopStripView
          ref={(el: HTMLElement) => (topStripRef = el)}
          routeTarget={routeTarget}
          status={status}
          hasFile={hasFile}
          isLoadingFile={() => isPlayRouteTarget(routeTarget()) && status() === 'loading'}
          context={() => uiStore.context}
          midiStatus={() => uiStore.midi.status}
          midiDeviceName={() => uiStore.midi.deviceName || ''}
          midiPillLabel={() => getMidiPillLabel(uiStore.midi.status, uiStore.midi.deviceName || '')}
          midiMenuLabel={() => getMidiMenuLabel(uiStore.midi.status, uiStore.midi.deviceName || '')}
          dim={dimTopStrip}
          onHome={() => props.actions.navigation.toTarget({ kind: 'play' })}
          onMode={(selection) =>
            props.actions.navigation.toTarget(
              selection === 'learn'
                ? { kind: 'learn-hub' }
                : selection === 'live'
                  ? { kind: 'live' }
                  : { kind: 'play' },
            )
          }
          onOpenFile={() => void props.actions.library.open({ kind: 'picker' })}
          onTracks={() => props.onOpenTracks?.()}
          onMidi={() => props.onMidiConnect?.()}
          onRecord={() => props.onRecord?.()}
          onLearnThis={() => void props.actions.learn.enter({ kind: 'current-midi' })}
          registerEl={(_el) => {}}
          registerTracksBtn={(el) => (tracksButtonRef = el)}
        />

        <LearnCoachmark
          eligible={() =>
            isPlayRouteTarget(routeTarget()) &&
            hasFile() &&
            status() !== 'loading' &&
            status() !== 'exporting'
          }
          onShow={() => setLearnCoachmarkSeen(true)}
        />

        <HudView
          routeTarget={routeTarget}
          status={status}
          showPlayHud={() =>
            isPlayRouteTarget(routeTarget()) && hasFile() && status() !== 'loading'
          }
          showLiveHud={() => isLiveRouteTarget(routeTarget())}
          playing={() => status() === 'playing'}
          instrumentLoading={instrumentLoading}
          sessionRecording={() => uiStore.session.recording}
          sessionLabel={() =>
            uiStore.session.recording
              ? formatMMSS(uiStore.session.elapsed)
              : t('hud.session.label.record')
          }
          loopState={() => uiStore.loop.state}
          loopLabel={() => loopLabel(uiStore.loop.state, uiStore.loop.layerCount)}
          loopProgressDeg={() => uiStore.loop.progressDeg}
          loopActive={() => {
            const s = uiStore.loop.state
            return s !== 'idle' && s !== 'armed'
          }}
          loopSaveVisible={() =>
            uiStore.loop.state === 'playing' || uiStore.loop.state === 'overdubbing'
          }
          loopUndoVisible={() => {
            const { state, layerCount } = uiStore.loop
            return state === 'overdubbing' || (state === 'playing' && layerCount >= 1)
          }}
          metroRunning={() => uiStore.metro.running}
          metroBpm={() => uiStore.metro.bpm}
          onPlay={handlePlayClick}
          onSkipBack={() => handleSkip(-SKIP_SECONDS)}
          onSkipFwd={() => handleSkip(SKIP_SECONDS)}
          onVolume={(v) => {
            setVolume(v)
            store.setState('volume', v)
            trackEventSettled('volume_changed', { volume: Math.round(v * 100) / 100 })
          }}
          onSpeed={(v) => {
            setSpeed(v)
            store.setState('speed', v)
            trackEventSettled('speed_changed', { speed: v })
          }}
          onZoom={(v) => {
            setZoom(v)
            props.onZoom?.(v)
            trackEventSettled('zoom_changed', { zoom: Math.round(v) })
          }}
          onMetroToggle={() => props.onMetronomeToggle?.()}
          onBpmDec={() => handleBpmChange(-1)}
          onBpmInc={() => handleBpmChange(+1)}
          onBpmWheel={(e) => {
            const dir = e.deltaY < 0 ? 1 : -1
            const step = e.shiftKey ? 10 : 1
            handleBpmChange(dir * step)
          }}
          onSession={() => props.onSessionToggle?.()}
          onLoop={() => props.onLoopToggle?.()}
          onLoopUndo={() => props.onLoopUndo?.()}
          onLoopSave={() => props.onLoopSave?.()}
          onLoopClear={() => props.onLoopClear?.()}
          onScrubberInput={handleScrubberInput}
          onScrubberChange={handleScrubberChange}
          onScrubberDown={handleScrubberDown}
          onScrubberTouch={handleScrubberTouch}
          registerScrubber={(el) => {
            scrubberRef = el
          }}
          registerTime={(el) => {
            timeDisplayRef = el
          }}
          registerDuration={(el) => {
            durationRef = el
          }}
          registerMetroBeat={(el) => {
            metroBeatRef = el
          }}
          volume={volume}
          speed={speed}
          speedLabel={() => formatSpeed(speed())}
          zoom={zoom}
          wakeRef={(fn) => {
            hudWakeFn = fn
          }}
          togglePinRef={(fn) => {
            hudTogglePinFn = fn
          }}
          onIdleChange={(idle) => {
            setHudIdle(idle)
            setDimTopStrip(idle)
          }}
          onHasDragged={() => {
            if (!hudHasDragged()) {
              setHudHasDragged(true)
              saveHudHasDragged()
            }
          }}
        />

        <DragCoachmark
          eligible={() =>
            learnCoachmarkSeen() &&
            !hudHasDragged() &&
            hasFile() &&
            status() !== 'loading' &&
            status() !== 'exporting' &&
            (isPlayRouteTarget(routeTarget()) || isLiveRouteTarget(routeTarget())) &&
            !hudIdle()
          }
          hasDragged={hudHasDragged}
        />

        <KeyHintView
          visible={() => isLiveRouteTarget(routeTarget())}
          idle={hudIdle}
          collapsed={keyHintHidden}
          octave={octave}
          onOctaveDown={() => props.onOctaveShift?.(-1)}
          onOctaveUp={() => props.onOctaveShift?.(+1)}
          onClose={() => {
            setKeyHintHidden(true)
            saveKeyHintHidden(true)
          }}
          onReopen={() => {
            setKeyHintHidden(false)
            saveKeyHintHidden(false)
          }}
        />
      </div>
    </ControlsContext.Provider>
  )
}
