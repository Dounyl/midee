import { describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '../test/renderWithApp'
import { ModeSwitch } from './ModeSwitch'

describe('ModeSwitch', () => {
  it('renders without throwing on useApp() inside the harness', () => {
    expect(() => renderWithApp(() => <ModeSwitch />)).not.toThrow()
  })

  it('mounts the home surface by default through the mode action', () => {
    const { ctx } = renderWithApp(() => <ModeSwitch />)
    expect(ctx.actions.mode.mount).toHaveBeenCalledWith('home')
  })

  it('reactively swaps to the learn surface when the store mode changes', async () => {
    const { ctx } = renderWithApp(() => <ModeSwitch />)
    expect(ctx.actions.learn.mount).not.toHaveBeenCalled()
    ctx.store.setState({ mode: 'learn' })
    await vi.waitFor(() => expect(ctx.actions.learn.mount).toHaveBeenCalledOnce())
  })

  it('renders the play landing without forcing the library action when no MIDI is loaded', () => {
    const { ctx } = renderWithApp(() => <ModeSwitch />)
    ctx.store.setState({ mode: 'play' })
    expect(ctx.actions.library.open).not.toHaveBeenCalled()
    expect(ctx.actions.mode.mount).toHaveBeenCalledWith('play')
  })

  it('mounts play with skipAnalytics when a MIDI is already loaded', () => {
    const { ctx } = renderWithApp(() => <ModeSwitch />)
    ctx.store.completePlayLoad({
      name: 'demo.mid',
      duration: 12,
      tracks: [],
    } as never)
    expect(ctx.store.state.mode).toBe('play')
    expect(ctx.actions.library.open).not.toHaveBeenCalled()
    expect(ctx.actions.mode.mount).toHaveBeenCalledWith('play', { skipAnalytics: true })
  })
})
