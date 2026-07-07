import { describe, expect, it, vi } from 'vitest'
import {
  enterRuntimeLiveRoute,
  resolveRuntimeOpenTarget,
  resolveRuntimeTelemetryMode,
} from '@/app/runtime/runtimeRouteSemantics'

vi.mock('@/pages/LivePage/liveEnterOptions', () => ({
  setNextLiveOpts: vi.fn(),
}))

describe('runtimeRouteSemantics', () => {
  it('resolves telemetry mode from route target', () => {
    expect(resolveRuntimeTelemetryMode(null)).toBe('play')
    expect(resolveRuntimeTelemetryMode({ kind: 'play' } as never)).toBe('play')
    expect(resolveRuntimeTelemetryMode({ kind: 'live' } as never)).toBe('live')
    expect(resolveRuntimeTelemetryMode({ kind: 'learn-hub' } as never)).toBe('learn')
    expect(resolveRuntimeTelemetryMode({ kind: 'exercise' } as never)).toBe('learn')
  })

  it('resolves open target from route target or explicit override', () => {
    expect(resolveRuntimeOpenTarget({ kind: 'play' } as never)).toBe('play')
    expect(resolveRuntimeOpenTarget({ kind: 'exercise' } as never)).toBe('learn')
    expect(resolveRuntimeOpenTarget({ kind: 'play' } as never, 'learn')).toBe('learn')
  })

  it('enters live route via narrow navigation callback', async () => {
    const navigate = vi.fn()
    const { setNextLiveOpts } = await import('@/pages/LivePage/liveEnterOptions')

    enterRuntimeLiveRoute({
      primeAudio: false,
      navigate,
    })

    expect(setNextLiveOpts).toHaveBeenCalledWith({ primeAudio: false })
    expect(navigate).toHaveBeenCalledWith({ kind: 'live' })
  })
})
