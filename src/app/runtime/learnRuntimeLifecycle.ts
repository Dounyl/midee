import type { LearnRuntimeHandle } from '@/features/learn/runtime/types'
import type { LearnRuntimeRegistryPort } from '@/services/runtime/contracts'

export interface LearnRuntimeLifecyclePort {
  activate(runtime: LearnRuntimeHandle): void
  deactivate(runtime: LearnRuntimeHandle): void
}

export interface CreateLearnRuntimeLifecycleOptions {
  registry: LearnRuntimeRegistryPort
  syncConsolePanel(): void
}

export function createLearnRuntimeLifecycle(
  options: CreateLearnRuntimeLifecycleOptions,
): LearnRuntimeLifecyclePort {
  return {
    activate(runtime) {
      options.registry.register(runtime)
      options.syncConsolePanel()
    },
    deactivate(runtime) {
      options.registry.unregister(runtime)
      options.syncConsolePanel()
    },
  }
}
