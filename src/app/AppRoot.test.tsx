import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@/test/renderWithApp'
import { AppRoot } from './AppRoot'

describe('AppRoot routing', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('redirects the root route to /play', async () => {
    window.history.pushState({}, '', '/')
    renderWithApp(() => <AppRoot />)
    await vi.waitFor(() => expect(window.location.pathname).toBe('/play'))
  })

  it('renders the learn page on /learn', async () => {
    window.history.pushState({}, '', '/learn')
    const { ctx } = renderWithApp(() => <AppRoot />)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await vi.waitFor(
      () => expect(ctx.actions.learn.enterHub).toHaveBeenCalledWith(expect.anything()),
      { timeout: 3_000 },
    )
  })

  it('enters the play route from the /play URL', async () => {
    window.history.pushState({}, '', '/play')
    const { ctx } = renderWithApp(() => <AppRoot />)
    await vi.waitFor(() => expect(ctx.actions.play.enter).toHaveBeenCalledOnce())
  })

  it('enters the live route from the /live URL', async () => {
    window.history.pushState({}, '', '/live')
    const { ctx } = renderWithApp(() => <AppRoot />)
    await vi.waitFor(() => expect(ctx.actions.live.enter).toHaveBeenCalledOnce())
  })
})
