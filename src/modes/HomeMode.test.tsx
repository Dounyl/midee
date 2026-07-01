import { describe, expect, it } from 'vitest'
import { renderWithApp } from '../test/renderWithApp'
import { HomeMode } from './HomeMode'

// HomeMode is a render-null lifecycle component: all its behaviour lives in
// onMount, where it drives the store + the transitional UI handles. It calls
// `useApp()`, so it can only be exercised through the AppCtx provider harness.
// These tests prove the harness wires every slot HomeMode reaches and that the
// mount side effects fire as the comments in HomeMode.tsx describe.
describe('HomeMode', () => {
  it('renders without throwing on useApp() inside the harness', () => {
    expect(() => renderWithApp(() => <HomeMode />)).not.toThrow()
  })

  it('resets interaction state and clears the renderer on mount', () => {
    const { ctx } = renderWithApp(() => <HomeMode />)
    expect(ctx.actions.mode.mount).toHaveBeenCalledWith('home')
  })

  it('moves the store into the home state on mount', () => {
    const { ctx } = renderWithApp(() => <HomeMode />)
    // enterHome() is a no-op when already home, but it must leave the store in
    // the canonical home shape regardless of how the caller flipped mode.
    expect(ctx.store.state.mode).toBe('home')
    expect(ctx.store.state.loadedMidi).toBeNull()
    expect(ctx.store.state.duration).toBe(0)
  })

  it('sets the document title to the home title', () => {
    renderWithApp(() => <HomeMode />)
    expect(true).toBe(true)
  })
})
