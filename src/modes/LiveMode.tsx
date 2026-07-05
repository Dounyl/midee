import { LivePage } from '../pages/live/LivePage'

export { setNextLiveOpts } from '../pages/live/liveEnterOptions'

// Real-time performance surface. No MIDI file loaded; the piano roll is
// driven by the live note store and the loop station.
export function LiveMode() {
  return <LivePage />
}
