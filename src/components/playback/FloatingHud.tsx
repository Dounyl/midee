// Shared draggable glass-pill wrapper used by every HUD in the app.
//
// Responsibilities:
//   - Glass pill visual (backdrop-filter, border, shadow) — shared CSS class `float-hud`
//   - Drag handle + pin button (always leftmost)
//   - Drag / viewport-clamp logic (pointer events, CSS var --hud-dx/dy)
//   - Idle-fade (opacity → 0.28 after idleMs of no pointer activity)
//   - localStorage persistence for pin and position (storageKey.pin / storageKey.offset)
//
// Escape hatches for the imperative Controls class:
//   wakeRef     — gives caller a handle to reset the idle timer (e.g. from mousemove or play state)
//   togglePinRef — gives caller a handle to toggle pin (e.g. from keyboard shortcut Shift+P)
//
// All children are composed freely inside the pill; layout (flex/grid) is up
// to the child content or caller-supplied CSS class.

import { createEffect, createSignal, type JSX, onCleanup, onMount } from 'solid-js'
import { icons } from '@/components/common/icons'
import { t } from '@/i18n'
import './FloatingHud.css'

export interface FloatingHudProps {
  storageKey: string
  idleMs?: number
  // Extra CSS classes on the root element (layout overrides, mode modifiers, etc.)
  class?: string
  // Dynamic class list merged onto the root (for reactive mode flags)
  classList?: () => Record<string, boolean>
  // Optional id on the root element (e.g. 'hud' for CSS ID-selector targeting)
  id?: string
  // Id on the drag button (for Coachmark anchoring, e.g. 'hud-drag')
  dragBtnId?: string
  // When false, idle scheduling is skipped entirely (e.g. main HUD only idles while playing)
  idleEnabled?: () => boolean
  // When true, idle scheduling is suppressed (e.g. recording / looping active)
  locked?: () => boolean
  // Called whenever pin state changes
  onPinChange?: (pinned: boolean) => void
  // Called the first time the user drags the HUD (for Coachmark dismissal)
  onHasDragged?: () => void
  // Gives caller a function to reset the idle timer externally
  wakeRef?: (wake: () => void) => void
  // Gives caller a function to toggle pin externally (e.g. keyboard shortcut)
  togglePinRef?: (toggle: () => void) => void
  // Called whenever idle state changes (true = just went idle, false = woke up)
  onIdleChange?: (idle: boolean) => void
  children: JSX.Element
}

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadPin(key: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(`${key}.pin`) ?? 'false') === true
  } catch {
    return false
  }
}

function savePin(key: string, v: boolean): void {
  try {
    localStorage.setItem(`${key}.pin`, JSON.stringify(v))
  } catch {
    // private-mode best effort
  }
}

function loadOffset(key: string): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(`${key}.offset`)
    if (!raw) return { x: 0, y: 0 }
    const p = JSON.parse(raw) as { x?: number; y?: number }
    return {
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
    }
  } catch {
    return { x: 0, y: 0 }
  }
}

function saveOffset(key: string, v: { x: number; y: number }): void {
  try {
    localStorage.setItem(`${key}.offset`, JSON.stringify(v))
  } catch {
    // private-mode best effort
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const DEFAULT_IDLE_MS = 2600
const HUD_EDGE_MARGIN = 16
const HUD_TOP_GAP = 12

export function FloatingHud(props: FloatingHudProps) {
  const init = loadOffset(props.storageKey)
  const [pinned, setPinned] = createSignal(loadPin(props.storageKey))
  const [dragging, setDragging] = createSignal(false)
  const [idle, setIdle] = createSignal(false)

  let rootEl!: HTMLDivElement
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let offsetX = init.x
  let offsetY = init.y
  let pendingOffsetX = init.x
  let pendingOffsetY = init.y
  let dragStartX = 0
  let dragStartY = 0
  let dragOriginX = 0
  let dragOriginY = 0
  let dragRafId: number | null = null
  let cachedHudWidth = 0
  let cachedHudHeight = 0
  let topStripObserver: ResizeObserver | null = null
  let hudResizeObserver: ResizeObserver | null = null
  let rootStyleObserver: MutationObserver | null = null

  // ── Idle-fade ───────────────────────────────────────────────────────────

  function clearTimer(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function scheduleIdle(): void {
    clearTimer()
    if (pinned() || props.locked?.() || props.idleEnabled?.() === false) return
    idleTimer = setTimeout(() => {
      setIdle(true)
      props.onIdleChange?.(true)
    }, props.idleMs ?? DEFAULT_IDLE_MS)
  }

  function wake(): void {
    if (idle()) props.onIdleChange?.(false)
    setIdle(false)
    scheduleIdle()
  }

  // ── Drag ────────────────────────────────────────────────────────────────

  function applyOffset(x: number = offsetX, y: number = offsetY): void {
    if (!rootEl) return
    rootEl.style.setProperty('--hud-dx', `${x}px`)
    rootEl.style.setProperty('--hud-dy', `${y}px`)
  }

  // Cached CSS layout vars — updated once on mount and on resize.
  let cachedKbdH = 120
  let cachedHudGap = 14
  let cachedTopLimit = 80

  function readLayoutVars(): void {
    const rs = getComputedStyle(document.documentElement)
    cachedKbdH = parseFloat(rs.getPropertyValue('--keyboard-h')) || 120
    cachedHudGap = parseFloat(rs.getPropertyValue('--hud-gap')) || 14
    const topStrip = document.getElementById('top-strip')
    cachedTopLimit = topStrip
      ? Math.ceil(topStrip.getBoundingClientRect().bottom + HUD_TOP_GAP)
      : 80
  }

  function readHudMetrics(): void {
    if (!rootEl) return
    const rect = rootEl.getBoundingClientRect()
    cachedHudWidth = rect.width
    cachedHudHeight = rect.height
  }

  function clampOffsetValues(nextX: number, nextY: number): { x: number; y: number } {
    if (cachedHudWidth === 0 || cachedHudHeight === 0) {
      applyOffset(nextX, nextY)
      readHudMetrics()
      if (cachedHudWidth === 0 || cachedHudHeight === 0) {
        return { x: nextX, y: nextY }
      }
    }
    const kh = cachedKbdH
    const gap = cachedHudGap
    const defaultLeft = (window.innerWidth - cachedHudWidth) / 2
    const bottomLimit = window.innerHeight - kh - cachedHudHeight - HUD_EDGE_MARGIN
    const defaultTop = bottomLimit - gap
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const nextLeft = clamp(
      defaultLeft + nextX,
      HUD_EDGE_MARGIN,
      Math.max(HUD_EDGE_MARGIN, window.innerWidth - cachedHudWidth - HUD_EDGE_MARGIN),
    )
    const nextTop = clamp(defaultTop + nextY, cachedTopLimit, Math.max(cachedTopLimit, bottomLimit))
    return {
      x: nextLeft - defaultLeft,
      y: nextTop - defaultTop,
    }
  }

  function commitOffset(nextX: number, nextY: number): void {
    const clamped = clampOffsetValues(nextX, nextY)
    offsetX = clamped.x
    offsetY = clamped.y
    applyOffset()
  }

  function flushPendingOffset(): void {
    dragRafId = null
    commitOffset(pendingOffsetX, pendingOffsetY)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging()) return
    pendingOffsetX = dragOriginX + (e.clientX - dragStartX)
    pendingOffsetY = dragOriginY + (e.clientY - dragStartY)
    if (dragRafId !== null) return
    dragRafId = requestAnimationFrame(flushPendingOffset)
  }

  function onPointerUp(): void {
    if (!dragging()) return
    if (dragRafId !== null) {
      cancelAnimationFrame(dragRafId)
      flushPendingOffset()
    }
    setDragging(false)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    saveOffset(props.storageKey, { x: offsetX, y: offsetY })
    props.onHasDragged?.()
  }

  function startDrag(e: PointerEvent): void {
    e.preventDefault()
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragOriginX = offsetX
    dragOriginY = offsetY
    pendingOffsetX = offsetX
    pendingOffsetY = offsetY
    setDragging(true)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  // ── Pin ──────────────────────────────────────────────────────────────────

  function togglePin(): void {
    const next = !pinned()
    setPinned(next)
    wake()
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  function onResize(): void {
    readLayoutVars()
    readHudMetrics()
    commitOffset(offsetX, offsetY)
  }

  onMount(() => {
    readLayoutVars()
    applyOffset()
    readHudMetrics()
    commitOffset(offsetX, offsetY)
    wake()
    window.addEventListener('resize', onResize)
    props.wakeRef?.(wake)
    props.togglePinRef?.(togglePin)

    const topStrip = document.getElementById('top-strip')
    if (topStrip && 'ResizeObserver' in window) {
      topStripObserver = new ResizeObserver(onResize)
      topStripObserver.observe(topStrip)
    }

    if ('ResizeObserver' in window) {
      hudResizeObserver = new ResizeObserver(() => {
        readHudMetrics()
        commitOffset(offsetX, offsetY)
      })
      hudResizeObserver.observe(rootEl)
    }

    rootStyleObserver = new MutationObserver(() => {
      readLayoutVars()
      readHudMetrics()
      commitOffset(offsetX, offsetY)
    })
    rootStyleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
  })

  onCleanup(() => {
    clearTimer()
    window.removeEventListener('resize', onResize)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    if (dragRafId !== null) cancelAnimationFrame(dragRafId)
    topStripObserver?.disconnect()
    hudResizeObserver?.disconnect()
    rootStyleObserver?.disconnect()
  })

  // Persist pin and notify caller whenever it changes.
  createEffect(() => {
    const p = pinned()
    savePin(props.storageKey, p)
    props.onPinChange?.(p)
    if (!p) scheduleIdle()
  })

  // ── Render ───────────────────────────────────────────────────────────────

  const rootClass = () => {
    const base = 'float-hud'
    const extra = props.class ? ` ${props.class}` : ''
    return base + extra
  }

  const rootClassList = () => ({
    'float-hud--dragging': dragging(),
    'float-hud--pinned': pinned(),
    'float-hud--idle': idle() && !pinned() && !dragging(),
    ...(props.classList?.() ?? {}),
  })

  return (
    <div
      id={props.id}
      ref={rootEl!}
      class={rootClass()}
      classList={rootClassList()}
      onPointerEnter={wake}
      onPointerMove={wake}
    >
      {/* Drag handle + pin — always leftmost */}
      <div class="float-hud__handle">
        <button
          class="hud-drag-handle float-hud__drag"
          id={props.dragBtnId}
          type="button"
          aria-label={t('hud.aria.drag')}
          data-tip={t('hud.drag')}
          onPointerDown={(e) => startDrag(e)}
          innerHTML={icons.grip(10)}
        />
        <button
          class="hud-pin-btn float-hud__pin"
          classList={{ 'hud-pin-btn--on': pinned() }}
          type="button"
          aria-label={t('hud.aria.pin')}
          aria-pressed={pinned()}
          data-tip={t('hud.pin')}
          onClick={togglePin}
          innerHTML={icons.pin(12)}
        />
      </div>

      <div class="float-hud__sep" />

      {props.children}
    </div>
  )
}
