import { PlayPage } from '@/pages/PlayPage/PlayPage'

// Playback surface for a loaded MIDI file. Mount happens when the store's
// mode transitions to 'play', which only occurs in `completePlayLoad`, so
// `loadedMidi` is already set by the time onMount runs for the fresh-load path.
// For the re-entry-from-live-or-learn path, loadedMidi was preserved from the
// earlier play session.
export function PlayMode() {
  return <PlayPage />
}
