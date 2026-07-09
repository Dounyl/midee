type ScoreDragPointerEventName = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'

export interface ScoreDragEventSource {
  addEventListener(type: ScoreDragPointerEventName, listener: (event: PointerEvent) => void): void
  removeEventListener(
    type: ScoreDragPointerEventName,
    listener: (event: PointerEvent) => void,
  ): void
}

export interface ScoreDragCursorHost {
  style: Pick<CSSStyleDeclaration, 'cursor'>
}

export interface ScoreDragCanvas {
  getBoundingClientRect(): DOMRect
}

export interface WireScoreDragSeekOptions {
  canvas: ScoreDragCanvas
  eventSource?: ScoreDragEventSource
  cursorHost?: ScoreDragCursorHost
  getPixelsPerSecond(): number
  getRollHeight(): number
  getNowLineY(): number
  getCurrentTime(): number
  canSeekFromScoreDrag(): boolean
  getHitTargetAtPoint?(clientX: number, clientY: number): Element | null
  seek(time: number): void
}

export function wireScoreDragSeek(options: WireScoreDragSeekOptions): () => void {
  const eventSource = options.eventSource ?? window
  const cursorHost = options.cursorHost ?? document.body
  const getHitTargetAtPoint =
    options.getHitTargetAtPoint ??
    ((clientX: number, clientY: number) => document.elementFromPoint(clientX, clientY))

  let activePointerId: number | null = null
  let dragTimeOrigin = 0
  let lastPointerX: number | null = null
  let lastPointerY: number | null = null

  const clearActiveDrag = (): void => {
    activePointerId = null
  }

  const setCursor = (cursor: '' | 'grab' | 'grabbing'): void => {
    cursorHost.style.cursor = cursor
  }

  const toLocalPoint = (
    clientX: number,
    clientY: number,
  ): { localX: number; localY: number; rect: DOMRect } => {
    const rect = options.canvas.getBoundingClientRect()
    return {
      localX: clientX - rect.left,
      localY: clientY - rect.top,
      rect,
    }
  }

  const isInScoreArea = (clientX: number, clientY: number): boolean => {
    const { localX, localY, rect } = toLocalPoint(clientX, clientY)
    return localX >= 0 && localX <= rect.width && localY >= 0 && localY <= options.getRollHeight()
  }

  const isIgnoredHitTarget = (target: Element | null): boolean => {
    if (!target) return false
    return (
      target.closest('.float-hud, button, input, select, textarea, a, [role="button"]') !== null
    )
  }

  const isHoveringScore = (): boolean => {
    if (lastPointerX === null || lastPointerY === null) return false
    if (!isInScoreArea(lastPointerX, lastPointerY)) return false
    return !isIgnoredHitTarget(getHitTargetAtPoint(lastPointerX, lastPointerY))
  }

  const resolveTimeFromOrigin = (clientX: number, clientY: number): number => {
    const { localY } = toLocalPoint(clientX, clientY)
    const pixelsPerSecond = options.getPixelsPerSecond()
    const nowLineY = options.getNowLineY()
    if (pixelsPerSecond <= 0) return options.getCurrentTime()
    return dragTimeOrigin + (localY - nowLineY) / pixelsPerSecond
  }

  const syncCursor = (): void => {
    if (activePointerId !== null) {
      setCursor('grabbing')
      return
    }
    if (options.canSeekFromScoreDrag() && isHoveringScore()) {
      setCursor('grab')
      return
    }
    setCursor('')
  }

  const onPointerDown = (event: PointerEvent): void => {
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    syncCursor()
    if (!options.canSeekFromScoreDrag()) return
    if (event.button !== undefined && event.button !== 0) return
    if (!isHoveringScore()) return

    const { localY } = toLocalPoint(event.clientX, event.clientY)
    const pixelsPerSecond = options.getPixelsPerSecond()
    const nowLineY = options.getNowLineY()
    activePointerId = event.pointerId
    dragTimeOrigin =
      pixelsPerSecond > 0
        ? options.getCurrentTime() - (localY - nowLineY) / pixelsPerSecond
        : options.getCurrentTime()
    ;(event.target as Element | null)?.setPointerCapture?.(event.pointerId)
    syncCursor()
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent): void => {
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    if (event.pointerId !== activePointerId) {
      syncCursor()
      return
    }
    if (!options.canSeekFromScoreDrag()) {
      clearActiveDrag()
      syncCursor()
      return
    }

    options.seek(resolveTimeFromOrigin(event.clientX, event.clientY))
    syncCursor()
    event.preventDefault()
  }

  const onPointerEnd = (event: PointerEvent): void => {
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    if (event.pointerId !== activePointerId) return
    clearActiveDrag()
    syncCursor()
  }

  eventSource.addEventListener('pointerdown', onPointerDown)
  eventSource.addEventListener('pointermove', onPointerMove)
  eventSource.addEventListener('pointerup', onPointerEnd)
  eventSource.addEventListener('pointercancel', onPointerEnd)

  return () => {
    clearActiveDrag()
    lastPointerX = null
    lastPointerY = null
    setCursor('')
    eventSource.removeEventListener('pointerdown', onPointerDown)
    eventSource.removeEventListener('pointermove', onPointerMove)
    eventSource.removeEventListener('pointerup', onPointerEnd)
    eventSource.removeEventListener('pointercancel', onPointerEnd)
  }
}
