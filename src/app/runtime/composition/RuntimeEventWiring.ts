import { bindRuntimeDomEvents } from '../runtimeDomEvents'
import { wireRuntimeEffects } from '../wireRuntimeEffects'
import { wireRuntimeInput } from '../wireRuntimeInput'
import type { RuntimeDependencies } from './RuntimeDependencies'
import type { RuntimeLifecycle } from './RuntimeLifecycle'
import type { RuntimeState } from './RuntimeState'

/**
 * RuntimeEventWiring
 *
 * 连接 effects 与 input 到 coordinators。
 * 职责：
 * - 连接 runtime effects（playback, midi, route 等）
 * - 连接 input handlers（midi, keyboard, touch）
 * - 连接 DOM 事件（visibility, blur, first interaction）
 * - 将所有订阅注册到 lifecycle（统一清理）
 */
export class RuntimeEventWiring {
  constructor(
    readonly _deps: RuntimeDependencies,
    readonly _state: RuntimeState,
    private readonly lifecycle: RuntimeLifecycle,
  ) {}

  /**
   * 连接所有 runtime effects
   */
  wireEffects(options: Parameters<typeof wireRuntimeEffects>[0]): void {
    for (const group of wireRuntimeEffects(options)) {
      this.lifecycle.registerGroup(group.label, ...group.unsubs)
    }
  }

  /**
   * 连接所有 input handlers
   */
  wireInput(options: Parameters<typeof wireRuntimeInput>[0]): void {
    for (const group of wireRuntimeInput(options)) {
      this.lifecycle.registerGroup(group.label, ...group.unsubs)
    }
  }

  /**
   * 连接 DOM 事件
   */
  wireDomEvents(handlers: {
    onVisibilityChange: () => void
    onWindowBlur: () => void
    onFirstPointerDown: () => void
    onFirstKeyDown: () => void
  }): void {
    const unsub = bindRuntimeDomEvents({
      documentTarget: document,
      windowTarget: window,
      onVisibilityChange: handlers.onVisibilityChange,
      onWindowBlur: handlers.onWindowBlur,
      onFirstPointerDown: handlers.onFirstPointerDown,
      onFirstKeyDown: handlers.onFirstKeyDown,
    })
    this.lifecycle.registerGroup('dom-events', unsub)
  }
}
