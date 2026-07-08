import { MasterClock } from '@/lib/core/MasterClock'
import { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import { SynthEngine } from '@/services/audio/SynthEngine'
import { InputBus } from '@/services/input/InputBus'
import { Metronome } from '@/services/audio/Metronome'
import { LiveNoteStore } from '@/services/midi/LiveNoteStore'
import { MidiInputManager } from '@/services/midi/MidiInputManager'
import { ComputerKeyboardInput } from '@/services/midi/ComputerKeyboardInput'
import { LiveLooper } from '@/services/midi/LiveLooper'
import { SessionRecorder } from '@/services/midi/SessionRecorder'
import { CaptureFanout } from '@/services/midi/CaptureFanout'
import { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import { createLivePerformanceBus, type LivePerformanceBus } from '@/services/performance/LivePerformanceBus'
import { ActiveLearnRuntimeRegistry } from '@/features/learn/runtime/ActiveLearnRuntimeRegistry'
import type { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import type { MidiFlowCoordinator } from '@/services/runtime/MidiFlowCoordinator'
import type { PlaybackCoordinator } from '@/services/runtime/PlaybackCoordinator'
import type { ExportAndOverlayCoordinator } from '@/services/runtime/ExportAndOverlayCoordinator'
import type { AppApplicationController } from '../AppApplicationController'
import type { AppStore } from '@/stores/app/state'

/**
 * RuntimeDependencies
 *
 * 持有所有 runtime 依赖的容器。
 * 职责：
 * - 实例化 core services（clock, renderer, synth等）
 * - 延迟实例化需要依赖的 services（midiInput, keyboardInput等）
 * - 提供类型安全的访问
 * - 统一 dispose 逻辑
 */
export class RuntimeDependencies {
  // ========== Core Services（构造时立即创建） ==========
  readonly clock: MasterClock
  readonly renderer: PianoRollRenderer
  readonly synth: SynthEngine
  readonly inputBus: InputBus
  readonly metronome: Metronome
  readonly store: AppStore

  // ========== Performance State ==========
  readonly liveNotes: LiveNoteStore
  readonly loopNotes: LiveNoteStore

  // ========== Learn ==========
  readonly learnRuntimeRegistry: ActiveLearnRuntimeRegistry

  // ========== Dependent Services（需要在 init 中创建） ==========
  midiInput!: MidiInputManager
  keyboardInput!: ComputerKeyboardInput
  keyboardModeCoordinator!: KeyboardModeCoordinator
  liveLooper!: LiveLooper
  sessionRec!: SessionRecorder
  capture!: CaptureFanout
  performanceBus!: LivePerformanceBus

  // ========== Coordinators（在 init 后期设置） ==========
  ui!: RuntimeUiBridge
  midiFlow!: MidiFlowCoordinator
  playback!: PlaybackCoordinator
  exportOverlay!: ExportAndOverlayCoordinator
  appController!: AppApplicationController

  // ========== Lazy Handles（在 AppRuntime 中创建，这里只保存引用） ==========
  postSessionHandle: any = null
  midiPickerHandle: any = null
  exportHandle: any = null

  constructor(store: AppStore) {
    this.store = store
    this.clock = new MasterClock()
    this.renderer = new PianoRollRenderer()
    this.synth = new SynthEngine()
    this.inputBus = new InputBus()
    this.metronome = new Metronome()
    this.liveNotes = new LiveNoteStore()
    this.loopNotes = new LiveNoteStore()
    this.learnRuntimeRegistry = new ActiveLearnRuntimeRegistry()
  }

  /**
   * 初始化需要依赖的 services
   * 必须在 renderer.init() 之后、coordinators 创建之前调用
   */
  initDependentServices(options: {
    keyboardMode: '61' | '88'
    persistKeyboardMode: (mode: '61' | '88') => void
    applyKeyboardMode: (mode: '61' | '88') => void
    getSyncConsolePanel: () => (() => void) | undefined
    getLooperCallbacks: () => {
      onPlaybackNoteOn: (pitch: number, velocity: number, ctxTime: number) => void
      onPlaybackNoteOff: (pitch: number, ctxTime: number) => void
    }
    getLooperSnapFn: () => (raw: number) => number
  }) {
    this.midiInput = new MidiInputManager(this.clock)
    this.keyboardInput = new ComputerKeyboardInput(this.clock)

    this.keyboardModeCoordinator = new KeyboardModeCoordinator({
      initialMode: options.keyboardMode,
      persistMode: options.persistKeyboardMode,
      applyMode: options.applyKeyboardMode,
      syncConsolePanel: () => options.getSyncConsolePanel()?.(),
    })

    this.liveLooper = new LiveLooper(
      this.clock,
      options.getLooperCallbacks(),
      options.getLooperSnapFn(),
    )

    this.sessionRec = new SessionRecorder(this.clock)
    this.capture = new CaptureFanout(this.liveLooper, this.sessionRec)
    this.performanceBus = createLivePerformanceBus()
  }

  /**
   * 设置 coordinators（在创建后调用）
   */
  setCoordinators(coordinators: {
    ui: RuntimeUiBridge
    midiFlow: MidiFlowCoordinator
    playback: PlaybackCoordinator
    exportOverlay: ExportAndOverlayCoordinator
  }) {
    this.ui = coordinators.ui
    this.midiFlow = coordinators.midiFlow
    this.playback = coordinators.playback
    this.exportOverlay = coordinators.exportOverlay
  }

  /**
   * 设置 application controller（在创建后调用）
   */
  setAppController(controller: AppApplicationController) {
    this.appController = controller
  }

  /**
   * 设置 lazy handles（从 AppRuntime 传入）
   */
  setLazyHandles(handles: {
    postSessionHandle: any
    midiPickerHandle: any
    exportHandle: any
  }) {
    this.postSessionHandle = handles.postSessionHandle
    this.midiPickerHandle = handles.midiPickerHandle
    this.exportHandle = handles.exportHandle
  }

  /**
   * 释放所有依赖
   */
  dispose() {
    this.midiInput?.dispose()
    this.keyboardInput?.dispose()
    this.liveLooper?.dispose()
    this.sessionRec?.dispose()
    this.metronome.dispose()
    this.ui?.dispose()
    this.clock.dispose()
    this.renderer.destroy()
    this.synth.dispose()
  }
}
