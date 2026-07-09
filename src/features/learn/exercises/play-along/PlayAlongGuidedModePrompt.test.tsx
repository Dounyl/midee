import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayAlongGuidedModePrompt } from './PlayAlongGuidedModePrompt'

describe('PlayAlongGuidedModePrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('auto-confirms the last mode after 20 seconds', async () => {
    const onConfirm = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)

    createPlayAlongGuidedModePrompt({
      reason: 'start',
      fallbackMode: 'practice',
      onConfirm,
    }).show(host)

    vi.advanceTimersByTime(20_000)
    await Promise.resolve()

    expect(onConfirm).toHaveBeenCalledWith('practice')
  })

  it('auto-confirms the currently selected mode after the countdown', async () => {
    const onConfirm = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)

    createPlayAlongGuidedModePrompt({
      reason: 'start',
      fallbackMode: 'demo',
      onConfirm,
      countdownSeconds: 1,
    }).show(host)

    const buttons = host.querySelectorAll('button')
    const practiceButton = buttons[1]
    expect(practiceButton).toBeTruthy()
    ;(practiceButton as HTMLButtonElement).click()

    vi.advanceTimersByTime(1_000)
    await Promise.resolve()

    expect(onConfirm).toHaveBeenCalledWith('practice')
  })

  it('starts immediately with the currently selected mode', () => {
    const onConfirm = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)

    createPlayAlongGuidedModePrompt({
      reason: 'replay',
      fallbackMode: 'demo',
      onConfirm,
    }).show(host)

    const buttons = host.querySelectorAll('button')
    const practiceButton = buttons[1]
    expect(practiceButton).toBeTruthy()
    ;(practiceButton as HTMLButtonElement).click()

    const startButton = buttons[2]
    expect(startButton).toBeTruthy()
    ;(startButton as HTMLButtonElement).click()

    expect(onConfirm).toHaveBeenCalledWith('practice')
  })

  it('confirms only once when timeout and click race together', async () => {
    const onConfirm = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)

    createPlayAlongGuidedModePrompt({
      reason: 'start',
      fallbackMode: 'demo',
      onConfirm,
      countdownSeconds: 1,
    }).show(host)

    vi.advanceTimersByTime(1_000)
    const startButton = host.querySelector('button:last-of-type')
    expect(startButton).toBeTruthy()
    ;(startButton as HTMLButtonElement).click()
    await Promise.resolve()

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('practice')
  })
})
