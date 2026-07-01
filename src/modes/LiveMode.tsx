import { createSignal, onMount } from 'solid-js'
import { useApp } from '../store/AppCtx'
import { trackEvent } from '../telemetry'
import type { EnterOptions } from './ModeController'

// Transient options for the next Live-mode entry. Populated by the caller
// immediately before flipping `mode` to 'live', read by LiveMode's onMount,
// then reset.
const [pendingOpts, setPendingOpts] = createSignal<EnterOptions>({ primeAudio: true })
export function setNextLiveOpts(opts: EnterOptions): void {
  setPendingOpts(opts)
}

// Real-time performance surface. No MIDI file loaded; the piano roll is
// driven by the live note store and the loop station.
export function LiveMode() {
  const { services, actions } = useApp()

  onMount(() => {
    const { primeAudio = true } = pendingOpts()
    setPendingOpts({ primeAudio: true })
    services.store.enterLive()
    actions.mode.mount('live')
    if (primeAudio) actions.session.primeInteractiveAudio()
    trackEvent('live_mode_entered', {
      midi_connected: false,
    })
  })
  return null
}
