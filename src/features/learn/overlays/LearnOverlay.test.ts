import { describe, expect, it, vi } from 'vitest'
import type { RenderContext } from '@/services/renderer/RenderLayer'
import { LearnOverlay } from './LearnOverlay'

function makeRenderContext(): RenderContext {
  return {
    time: 0,
    dt: 0,
    theme: {} as never,
    viewport: {} as never,
  }
}

function makeGraphicsStub() {
  return {
    clear: vi.fn(),
    circle: vi.fn(),
    fill: vi.fn(),
  }
}

describe('LearnOverlay practiceSuccessBurst', () => {
  it('keeps delayed celebrations queued until their start time', () => {
    const overlay = new LearnOverlay()
    const graphics = makeGraphicsStub()
    const nowSpy = vi.spyOn(performance, 'now')
    ;(overlay as unknown as { celebrationGraphic: typeof graphics | null }).celebrationGraphic =
      graphics

    overlay.practiceSuccessBurst(320, 180, 0xfbd38d, 1000)

    nowSpy.mockReturnValue(1000)
    ;(overlay as unknown as { drawCelebrations(ctx: RenderContext): void }).drawCelebrations(
      makeRenderContext(),
    )

    expect((overlay as unknown as { celebrations: unknown[] }).celebrations).toHaveLength(3)
    expect(graphics.circle).toHaveBeenCalledTimes(1)

    graphics.circle.mockClear()
    graphics.fill.mockClear()

    nowSpy.mockReturnValue(1030)
    ;(overlay as unknown as { drawCelebrations(ctx: RenderContext): void }).drawCelebrations(
      makeRenderContext(),
    )

    expect((overlay as unknown as { celebrations: unknown[] }).celebrations).toHaveLength(3)
    expect(graphics.circle).toHaveBeenCalledTimes(2)

    nowSpy.mockRestore()
  })
})
