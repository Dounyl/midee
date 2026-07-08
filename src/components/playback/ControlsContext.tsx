import { type Accessor, createContext, useContext } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import type { LiveLooperState } from '@/services/midi/LiveLooper'
import type { MidiDeviceStatus } from '@/services/midi/MidiInputCoordinator'
import type { AppActions } from '@/stores/app/AppCtx'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import type { AppServices } from '@/types/app/AppServices'

/**
 * UI Store shape - matches the original Controls implementation
 */
export interface UiStoreShape {
  context: {
    kicker: string
    title: string
  }
  midiLibrary: {
    entries: Array<{ id: string; name: string }>
    open: boolean
  }
  midi: {
    status: MidiDeviceStatus
    deviceName: string | null
  }
  session: {
    recording: boolean
    elapsed: number
  }
  loop: {
    state: LiveLooperState
    layerCount: number
    progressDeg: number
  }
  metro: {
    running: boolean
    bpm: number
  }
}

/**
 * Controls Context - provides shared state and actions to all child components
 */
export interface ControlsContextValue {
  // Services
  services: AppServices
  actions: AppActions

  // Reactive state
  routeTarget: Accessor<RouteTarget | null>
  status: Accessor<string>
  hasFile: Accessor<boolean>
  dimTopStrip: Accessor<boolean>
  hudIdle: Accessor<boolean>
  hudHasDragged: Accessor<boolean>
  instrumentLoading: Accessor<boolean>
  octave: Accessor<number>
  volume: Accessor<number>
  speed: Accessor<number>
  zoom: Accessor<number>

  // UI Store
  uiStore: UiStoreShape
  setUi: SetStoreFunction<UiStoreShape>

  // Setters
  setDimTopStrip: (v: boolean) => void
  setHudIdle: (v: boolean) => void
  setHudHasDragged: (v: boolean) => void
  setInstrumentLoading: (v: boolean) => void
  setOctave: (v: number) => void
  setVolume: (v: number) => void
  setSpeed: (v: number) => void
  setZoom: (v: number) => void

  // Actions
  handlePlayClick: () => void
  handleSkip: (delta: number) => void
  handleBpmChange: (delta: number) => void
  wakeUp: () => void
  updateContext: (fileName: string | null) => void

  // Refs (for imperative access)
  scrubberRef?: HTMLInputElement | undefined
  topStripRef?: HTMLElement | undefined

  // Callbacks from options
  onSeek?: ((t: number) => void) | undefined
  onZoom?: ((pps: number) => void) | undefined
  onThemeCycle?: (() => void) | undefined
  onMidiConnect?: (() => void) | undefined
  onTracksOpen?: (() => void) | undefined
  onExportOpen?: (() => void) | undefined
  onTransposeChange?: ((semitones: number) => void) | undefined
  onInstrumentCycle?: (() => void) | undefined
  onParticleStyleCycle?: (() => void) | undefined
  onLoopToggle?: (() => void) | undefined
  onLoopClear?: (() => void) | undefined
  onLoopSave?: (() => void) | undefined
  onLoopUndo?: (() => void) | undefined
  onMetroToggle?: (() => void) | undefined
  onMetroBpmChange?: ((bpm: number) => void) | undefined
  onSessionToggle?: (() => void) | undefined
  onChordToggle?: (() => void) | undefined
  onOctaveShift?: ((delta: number) => void) | undefined
}

const ControlsContext = createContext<ControlsContextValue>()

/**
 * Hook to access Controls context
 */
export function useControls(): ControlsContextValue {
  const ctx = useContext(ControlsContext)
  if (!ctx) {
    throw new Error('useControls must be used within a Controls component')
  }
  return ctx
}

export { ControlsContext }
