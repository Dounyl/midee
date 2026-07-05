import { onMount } from 'solid-js'
import { useApp } from '../../store/AppCtx'
import { trackEvent } from '../../telemetry'
import { consumeNextLiveOpts } from './liveEnterOptions'

export function LivePage() {
  const { actions, services } = useApp()

  onMount(() => {
    const { primeAudio = true } = consumeNextLiveOpts()
    services.store.enterLive()
    actions.live.enter()
    if (primeAudio) actions.session.primeInteractiveAudio()
    trackEvent('live_mode_entered', {
      midi_connected: false,
    })
  })

  return null
}
