import { describe, expect, it, vi } from 'vitest'
import { createLearnRuntimeLifecycle } from '@/app/runtime/learnRuntimeLifecycle'

describe('createLearnRuntimeLifecycle', () => {
  it('registers and unregisters runtimes while resyncing the console', () => {
    const register = vi.fn()
    const unregister = vi.fn()
    const syncConsolePanel = vi.fn()
    const runtime = { routeId: 'play-along', enter: vi.fn(), exit: vi.fn() } as never

    const lifecycle = createLearnRuntimeLifecycle({
      registry: {
        register,
        unregister,
      } as never,
      syncConsolePanel,
    })

    lifecycle.activate(runtime)
    lifecycle.deactivate(runtime)

    expect(register).toHaveBeenCalledWith(runtime)
    expect(unregister).toHaveBeenCalledWith(runtime)
    expect(syncConsolePanel).toHaveBeenCalledTimes(2)
  })
})
