/**
 * RuntimeLifecycle
 *
 * 管理 runtime 生命周期与订阅清理。
 * 职责：
 * - 追踪初始化/销毁状态
 * - 注册订阅分组（带标签，便于调试）
 * - 统一清理所有订阅
 * - 提供状态断言（防止未初始化或已销毁时调用）
 */
export class RuntimeLifecycle {
  private unsubs: Array<() => void> = []
  private subscriptionLabels = new Set<string>()
  private initialized = false
  private disposed = false

  /**
   * 注册一组订阅，标记为 label 方便调试
   * @throws 如果 label 已存在（防止重复注册）
   */
  registerGroup(label: string, ...unsubs: Array<() => void>): void {
    if (this.subscriptionLabels.has(label)) {
      throw new Error(`Duplicate subscription group: ${label}`)
    }
    this.subscriptionLabels.add(label)
    this.unsubs.push(() => {
      this.subscriptionLabels.delete(label)
      for (const unsub of unsubs) unsub()
    })
  }

  /**
   * 标记为已初始化
   * @throws 如果已初始化
   */
  markInitialized(): void {
    if (this.initialized) {
      throw new Error('Runtime already initialized')
    }
    this.initialized = true
  }

  /**
   * 清理所有订阅
   * @throws 如果未初始化或已销毁
   */
  dispose(): void {
    if (this.disposed) {
      throw new Error('Runtime already disposed')
    }
    if (!this.initialized) {
      throw new Error('Cannot dispose uninitialized runtime')
    }
    this.disposed = true
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
  }

  /**
   * 断言 runtime 已就绪（已初始化且未销毁）
   * @throws 如果未初始化或已销毁
   */
  assertReady(action: string): void {
    if (!this.initialized) {
      throw new Error(`${action}() called before runtime initialized`)
    }
    if (this.disposed) {
      throw new Error(`${action}() called after runtime disposed`)
    }
  }

  /**
   * 获取当前状态（只读）
   */
  get isInitialized(): boolean {
    return this.initialized
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /**
   * 获取已注册的订阅分组标签（用于调试）
   */
  get registeredGroups(): ReadonlySet<string> {
    return this.subscriptionLabels
  }
}
