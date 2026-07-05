import { HomePage } from '@/pages/HomePage/HomePage'

// Landing surface — no loaded MIDI, no live session yet. Typing keyboard is
// kept live so the first key-press dissolves into live mode without an extra
// click (see App.handleLiveNoteOn for the `mode === 'home'` branch).
//
// Side effects run in onMount; by the time Solid mounts this component the
// store's mode is already 'home' (caller flipped it before the transition,
// or App.setMode('home') did). Calling `store.enterHome()` here is a no-op
// but keeps the shape resilient to callers that flipped `mode` without the
// other fields.
export function HomeMode() {
  return <HomePage />
}
