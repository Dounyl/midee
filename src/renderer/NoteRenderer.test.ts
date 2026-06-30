import { describe, expect, it, vi } from 'vitest'
import type { MidiTrack } from '../core/midi/types'
import { NoteRenderer } from './NoteRenderer'
import { darkTheme } from './theme'
import { Viewport } from './viewport'

vi.mock('pixi.js', () => {
  class Container {
    children: unknown[] = []
    label = ''
    visible = true
    filters?: unknown[]

    addChild<T>(child: T): T {
      this.children.push(child)
      return child
    }

    addChildAt<T>(child: T, index: number): T {
      this.children.splice(index, 0, child)
      return child
    }

    removeChild(child: unknown): void {
      const index = this.children.indexOf(child)
      if (index >= 0) this.children.splice(index, 1)
    }
  }

  class Graphics extends Container {
    clear(): void {}
    roundRect(): void {}
    fill(): void {}
    destroy(): void {}
  }

  class Text extends Container {
    text = ''
    style: Record<string, unknown> = {}
    x = 0
    y = 0
    alpha = 1
    anchor = { set: () => {} }

    constructor(init?: { text?: string; style?: Record<string, unknown> }) {
      super()
      this.text = init?.text ?? ''
      this.style = init?.style ?? {}
    }
  }

  return { Container, Graphics, Text }
})

vi.mock('pixi-filters', () => ({
  GlowFilter: class {
    color = 0
    distance = 0
    outerStrength = 0

    constructor(opts?: Partial<{ color: number; distance: number; outerStrength: number }>) {
      Object.assign(this, opts)
    }
  },
}))

const makeViewport = () =>
  new Viewport({
    canvasWidth: 1000,
    canvasHeight: 600,
    keyboardHeight: 100,
    pixelsPerSecond: 200,
  })

const makeTrack = (): MidiTrack => ({
  id: 'track-1',
  name: 'Track 1',
  channel: 0,
  instrument: 0,
  isDrum: false,
  color: 0xffffff,
  colorIndex: 0,
  notes: [
    { pitch: 60, time: 10, duration: 0.25, velocity: 0.8 },
    { pitch: 62, time: 10, duration: 1.5, velocity: 0.8 },
  ],
})

describe('NoteRenderer', () => {
  it('keeps note labels the same distance from the bottom for short and long notes', () => {
    const renderer = new NoteRenderer(darkTheme)
    const track = makeTrack()
    const viewport = makeViewport()

    renderer.setTracks([track])
    renderer.draw([track], 10, viewport, new Set([track.id]), null)

    const labels = Reflect.get(renderer, 'labelPool') as Array<{ y: number }>
    expect(labels).toHaveLength(2)

    const shortBottom = viewport.nowLineY
    const longBottom = viewport.nowLineY

    expect(shortBottom - labels[0]!.y).toBeCloseTo(16)
    expect(longBottom - labels[1]!.y).toBeCloseTo(16)
    expect(labels[0]!.y).toBeCloseTo(labels[1]!.y)
  })
})
