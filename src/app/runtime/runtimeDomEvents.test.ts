import { describe, expect, it, vi } from 'vitest'
import { bindRuntimeDomEvents } from '@/app/runtime/runtimeDomEvents'

describe('bindRuntimeDomEvents', () => {
  it('registers runtime DOM events and returns a cleanup function', () => {
    const documentTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const windowTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    const cleanup = bindRuntimeDomEvents({
      documentTarget: documentTarget as never,
      windowTarget: windowTarget as never,
      onVisibilityChange: vi.fn(),
      onWindowBlur: vi.fn(),
      onFirstPointerDown: vi.fn(),
      onFirstKeyDown: vi.fn(),
    })

    expect(documentTarget.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
    expect(windowTarget.addEventListener).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      { passive: true },
    )
    expect(windowTarget.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), {
      passive: true,
    })

    cleanup()

    expect(documentTarget.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
    )
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
