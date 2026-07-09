import { describe, expect, it, vi } from 'vitest'
import { wireScoreDragSeek } from './wireScoreDragSeek'

function createCanvasStub() {
  return {
    canvas: {
      getBoundingClientRect: () => ({ left: 0, top: 100, width: 800, height: 620 }) as DOMRect,
    },
  }
}

function createEventSourceStub() {
  const handlers = new Map<string, (event: PointerEvent) => void>()
  return {
    eventSource: {
      addEventListener: vi.fn((type: string, handler: (event: PointerEvent) => void) => {
        handlers.set(type, handler)
      }),
      removeEventListener: vi.fn((type: string) => {
        handlers.delete(type)
      }),
    },
    handlers,
  }
}

function pointerEvent(init: Partial<PointerEvent>): PointerEvent {
  return init as unknown as PointerEvent
}

function captureTarget(): EventTarget {
  return { setPointerCapture: vi.fn() } as unknown as EventTarget
}

describe('wireScoreDragSeek', () => {
  it('seeks with vertical score dragging while explicitly paused', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }
    let currentTime = 12
    const paused = true
    const seek = vi.fn((time: number) => {
      currentTime = time
    })

    const detach = wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 500,
      getCurrentTime: () => currentTime,
      canSeekFromScoreDrag: () => paused,
      getHitTargetAtPoint: () => null,
      seek,
    })

    const preventDefault = vi.fn()
    handlers.get('pointerdown')?.(
      pointerEvent({
        button: 0,
        clientX: 120,
        clientY: 260,
        currentTarget: captureTarget(),
        pointerId: 7,
        preventDefault,
      }),
    )
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 360,
        pointerId: 7,
        preventDefault,
      }),
    )

    expect(preventDefault).toHaveBeenCalled()
    expect(cursorHost.style.cursor).toBe('grabbing')
    expect(seek).toHaveBeenCalledWith(12.5)

    handlers.get('pointerup')?.(pointerEvent({ clientX: 120, clientY: 360, pointerId: 7 }))
    expect(cursorHost.style.cursor).toBe('grab')
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 420,
        pointerId: 7,
        preventDefault,
      }),
    )
    expect(seek).toHaveBeenCalledTimes(1)

    detach()
    expect(cursorHost.style.cursor).toBe('')
  })

  it('keeps drag speed stable instead of compounding seeked currentTime', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }
    let currentTime = 12
    const seek = vi.fn((time: number) => {
      currentTime = time
    })

    wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 420,
      getCurrentTime: () => currentTime,
      canSeekFromScoreDrag: () => true,
      getHitTargetAtPoint: () => null,
      seek,
    })

    handlers.get('pointerdown')?.(
      pointerEvent({
        button: 0,
        clientX: 120,
        clientY: 260,
        currentTarget: captureTarget(),
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 360,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 460,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )

    expect(seek).toHaveBeenNthCalledWith(1, 12.5)
    expect(seek).toHaveBeenNthCalledWith(2, 13)
  })

  it('ignores drags while playback intent is still active', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }
    const seek = vi.fn()

    wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 500,
      getCurrentTime: () => 12,
      canSeekFromScoreDrag: () => false,
      getHitTargetAtPoint: () => null,
      seek,
    })

    handlers.get('pointerdown')?.(
      pointerEvent({
        button: 0,
        clientX: 120,
        clientY: 260,
        currentTarget: captureTarget(),
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 360,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )

    expect(seek).not.toHaveBeenCalled()
    expect(cursorHost.style.cursor).toBe('')
  })

  it('ignores drags that start on floating hud controls', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }
    const seek = vi.fn()
    const hudButton = document.createElement('button')
    const hud = document.createElement('div')
    hud.className = 'float-hud'
    hud.appendChild(hudButton)

    wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 500,
      getCurrentTime: () => 12,
      canSeekFromScoreDrag: () => true,
      getHitTargetAtPoint: () => hudButton,
      seek,
    })

    handlers.get('pointerdown')?.(
      pointerEvent({
        button: 0,
        clientX: 120,
        clientY: 260,
        currentTarget: captureTarget(),
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )
    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 360,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )

    expect(seek).not.toHaveBeenCalled()
    expect(cursorHost.style.cursor).toBe('')
  })

  it('shows a grab cursor when hovering the score while paused', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }

    const detach = wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 500,
      getCurrentTime: () => 12,
      canSeekFromScoreDrag: () => true,
      getHitTargetAtPoint: () => null,
      seek: vi.fn(),
    })

    handlers.get('pointermove')?.(
      pointerEvent({
        clientX: 120,
        clientY: 260,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )
    expect(cursorHost.style.cursor).toBe('grab')

    detach()
    expect(cursorHost.style.cursor).toBe('')
  })

  it('captures the real hit target instead of the event currentTarget', () => {
    const { canvas } = createCanvasStub()
    const { eventSource, handlers } = createEventSourceStub()
    const cursorHost = { style: { cursor: '' as '' | 'grab' | 'grabbing' } }
    const setPointerCapture = vi.fn()
    const target = { setPointerCapture } as unknown as EventTarget
    const currentTarget = {} as EventTarget

    wireScoreDragSeek({
      canvas,
      eventSource,
      cursorHost,
      getPixelsPerSecond: () => 200,
      getRollHeight: () => 500,
      getNowLineY: () => 500,
      getCurrentTime: () => 12,
      canSeekFromScoreDrag: () => true,
      getHitTargetAtPoint: () => null,
      seek: vi.fn(),
    })

    handlers.get('pointerdown')?.(
      pointerEvent({
        button: 0,
        clientX: 120,
        clientY: 260,
        currentTarget,
        target,
        pointerId: 7,
        preventDefault: vi.fn(),
      }),
    )

    expect(setPointerCapture).toHaveBeenCalledWith(7)
  })
})
