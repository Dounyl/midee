import { Show } from 'solid-js'
import { SHOW_FPS } from '@/env'
import { AppRouter } from '@/app/router/AppRouter'
import { FpsOverlay } from '@/components/common/FpsOverlay'

// Solid-owned root. Router now selects the active page shell while the
// long-lived runtime stays outside route matching.
export function AppRoot() {
  return (
    <>
      <AppRouter />
      <Show when={SHOW_FPS}>
        <FpsOverlay />
      </Show>
    </>
  )
}
