import { describe, expect, it, vi } from 'vitest'
import { KeyboardRenderer } from './KeyboardRenderer'
import { darkTheme } from './theme'

vi.mock('pixi.js', () => {
  class Container {
    children: unknown[] = []
    label = ''
    y = 0
    height = 0

    addChild<T>(child: T): T {
      this.children.push(child)
      return child
    }

    addChildAt<T>(child: T, index: number): T {
      this.children.splice(index, 0, child)
      return child
    }
  }

  class Graphics extends Container {
    clear(): void {}
    roundRect(): void {}
    rect(): void {}
    fill(): void {}
  }

  return {
    Container,
    Graphics,
    RenderTexture: { create: vi.fn() },
    Sprite: class extends Container {},
    Text: class extends Container {},
    Texture: { from: vi.fn() },
    TilingSprite: class extends Container {},
  }
})

describe('KeyboardRenderer', () => {
  it('throttles practice hint pulse redraws while the ticker is running', () => {
    const add = vi.fn()
    const remove = vi.fn()
    const renderer = new KeyboardRenderer(
      { ticker: { add, remove }, renderer: { render: vi.fn() } } as never,
      darkTheme,
    )
    const drawPracticeHints = vi.spyOn(
      renderer as unknown as { drawPracticeHints: () => void },
      'drawPracticeHints',
    )

    Reflect.set(renderer, 'lastPositions', new Map([[60, { x: 0, width: 20 }]]))
    Reflect.set(renderer, 'whiteSprite', { y: 0, height: 100 })

    renderer.setPracticeHints(new Set([60]), null, darkTheme)

    expect(drawPracticeHints).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledOnce()

    const tickerHandler = add.mock.calls[0]?.[0] as ((ticker: { deltaTime: number; deltaMS: number }) => void)
    expect(typeof tickerHandler).toBe('function')

    tickerHandler({ deltaTime: 1, deltaMS: 16 })
    tickerHandler({ deltaTime: 1, deltaMS: 16 })
    tickerHandler({ deltaTime: 1, deltaMS: 16 })
    expect(drawPracticeHints).toHaveBeenCalledTimes(1)

    tickerHandler({ deltaTime: 1, deltaMS: 16 })
    expect(drawPracticeHints).toHaveBeenCalledTimes(2)

    renderer.setPracticeHints(null, null, darkTheme)
    expect(remove).toHaveBeenCalledOnce()
    expect(drawPracticeHints).toHaveBeenCalledTimes(3)
  })
})
