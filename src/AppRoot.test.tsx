import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoot } from '@/app/AppRoot'
import { SKIP_HOME_INTRO_STORAGE_KEY } from '@/stores/app/state'
import { renderWithApp } from './test/renderWithApp'

describe('AppRoot routing', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
    localStorage.removeItem(SKIP_HOME_INTRO_STORAGE_KEY)
  })

  it('renders the home page on the root route', () => {
    window.history.pushState({}, '', '/')
    const { ctx } = renderWithApp(() => <AppRoot />)
    expect(ctx.actions.home.enter).toHaveBeenCalledOnce()
  })

  it('redirects the root route to /play when skip-home is enabled', async () => {
    localStorage.setItem(SKIP_HOME_INTRO_STORAGE_KEY, 'true')
    window.history.pushState({}, '', '/')
    renderWithApp(() => <AppRoot />)
    await vi.waitFor(() => expect(window.location.pathname).toBe('/play'))
  })

  it('renders the learn page on /learn', async () => {
    window.history.pushState({}, '', '/learn')
    const { ctx } = renderWithApp(() => <AppRoot />)
    await vi.waitFor(() => expect(ctx.actions.learn.enterRoute).toHaveBeenCalledOnce())
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
