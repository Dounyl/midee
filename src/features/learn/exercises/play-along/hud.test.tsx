import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlayAlongHudView } from './hud'

vi.mock('@/components/playback/FloatingHud', () => ({
  FloatingHud: (props: { children?: JSX.Element }) => <div>{props.children}</div>,
}))

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, number>) =>
    key === 'learn.pa.speedPctAria' ? `${params?.pct ?? 0}` : key,
}))

function createEngine() {
  return {
    state: {
      duration: 60,
      userWantsToPlay: true,
      waitEnabled: false,
      tempoRampEnabled: false,
      speedPct: 100,
      guidedMode: 'demo' as const,
      hand: 'both' as const,
      loopRegion: null,
      loopMark: null,
    },
    services: {
      clock: {
        subscribe: vi.fn(() => () => {}),
      },
    },
    seek: vi.fn(),
    togglePlay: vi.fn(),
    setSpeedPreset: vi.fn(),
    setGuidedMode: vi.fn(),
    setHand: vi.fn(),
    setWaitEnabled: vi.fn(),
    setTempoRamp: vi.fn(),
  }
}

describe('PlayAlongHudView', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('previews scrubber position during drag and seeks only on release', () => {
    const engine = createEngine()
    const result = render(() => (
      <PlayAlongHudView engine={engine as never} onMarkLoop={vi.fn()} onClearLoop={vi.fn()} />
    ))

    const scrubber = document.querySelector('.pa-hud__scrubber') as HTMLInputElement | null
    const time = document.querySelector('.pa-hud__time') as HTMLSpanElement | null

    expect(scrubber).not.toBeNull()
    expect(time).not.toBeNull()

    scrubber!.value = '12'
    const pointerDown =
      typeof window.PointerEvent === 'function'
        ? new window.PointerEvent('pointerdown', { bubbles: true })
        : new Event('pointerdown', { bubbles: true })
    scrubber!.dispatchEvent(pointerDown)
    scrubber!.dispatchEvent(new Event('input', { bubbles: true }))

    expect(engine.seek).not.toHaveBeenCalled()
    expect(time?.textContent).toBe('0:12')

    scrubber!.dispatchEvent(new Event('change', { bubbles: true }))

    expect(engine.seek).toHaveBeenCalledOnce()
    expect(engine.seek).toHaveBeenCalledWith(12)

    result.unmount()
  })

  it('switches guided modes from the transport row control', () => {
    const engine = createEngine()
    render(() => (
      <PlayAlongHudView engine={engine as never} onMarkLoop={vi.fn()} onClearLoop={vi.fn()} />
    ))

    const buttons = Array.from(document.querySelectorAll('.pa-hud__seg-track--mode .pa-hud__seg'))
    expect(buttons).toHaveLength(2)

    ;(buttons[1] as HTMLButtonElement).click()

    expect(engine.setGuidedMode).toHaveBeenCalledWith('practice')
  })
})
