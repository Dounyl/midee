import type { RuntimeDependencies } from './RuntimeDependencies'
import type { RuntimeState } from './RuntimeState'
import type { AppRuntimeUiShell } from '../appRuntimeUiShell'
import { createAppRuntimePortBundle } from '../appRuntimePorts'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import { getCurrentRouteTarget, navigateToTarget } from '@/stores/routing/routerBridge'

/**
 * RuntimePortsFactory
 *
 * 构建 runtime port bundles（services, ui, navigation）。
 * 职责：
 * - 创建 services port（clock, synth, renderer 等）
 * - 创建 ui port（loading, error, modals）
 * - 创建 navigation port（getCurrentTarget, navigate, enterLive）
 * - 连接回调（primeAudio, modals, learn registry）
 */
export class RuntimePortsFactory {
  constructor(
    private readonly deps: RuntimeDependencies,
    private readonly state: RuntimeState,
    private readonly uiShell: AppRuntimeUiShell,
  ) {}

  /**
   * 创建完整的 port bundle
   * 在 AppRuntime.init() 中调用，用于传递给 coordinators
   */
  createPorts() {
    const deps = this.deps
    const state = this.state
    const uiShell = this.uiShell

    return createAppRuntimePortBundle({
      services: {
        clock: deps.clock,
        synth: deps.synth,
        metronome: deps.metronome,
        renderer: deps.renderer,
        input: deps.inputBus,
        keyboardMode: deps.keyboardModeCoordinator,
      },
      primeInteractiveAudio: () => this.primeAudio(),
      getUi: () => deps.ui,
      showLoading: () => uiShell.showLoading(),
      hideLoading: () => uiShell.hideLoading(),
      showError: (message) => uiShell.showError(message),
      showSuccess: (message) => uiShell.showSuccess(message),
      closeTransientOverlays: () => uiShell.closeTransientOverlays(),
      openExportModal: async () => {
        const modal = await deps.exportHandle.get()
        modal.open()
      },
      peekExportModal: () => deps.exportHandle.peek(),
      openPostSession: async (duration, noteCount) => {
        const modal = await deps.postSessionHandle.get()
        modal.open(duration, noteCount)
      },
      closePostSession: () => {
        deps.postSessionHandle.peek()?.close()
      },
      openMidiPicker: async (options) => {
        const modal = await deps.midiPickerHandle.get()
        modal.open(options)
      },
      closeMidiPicker: () => {
        deps.midiPickerHandle.peek()?.close()
      },
      getCurrentTarget: (): RouteTarget | null => getCurrentRouteTarget(),
      navigate: (target, options) => {
        navigateToTarget(target, options)
      },
      enterLive: (primeAudio = true) => {
        if (primeAudio) this.primeAudio()
        navigateToTarget({ kind: 'live' })
      },
    })
  }

  /**
   * Prime interactive audio
   * 确保音频上下文已激活，移除首次交互监听器
   */
  private primeAudio(): void {
    if (this.state.audioPrimed) return
    this.state.markAudioPrimed()
    this.deps.clock.prime()
    this.deps.synth.primeLiveInput()
    // Note: 移除监听器需要在 AppRuntime 中处理（因为那里持有 handler 引用）
  }
}
