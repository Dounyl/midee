# Runtime Unification QA

## Required Manual Scenarios
- Cold boot on `/`: home surface renders, no console errors, `#pianoroll` and `#ui-overlay` both exist.
- Cold boot on `/learn`: learn hub route loads directly, no redirect flicker, no console errors.
- Home to play via picker: open a local MIDI, play HUD appears, scrubber and export button become available.
- Sample to play: open a bundled sample from home or picker, playback route loads and track panel works.
- Sample to learn: open a bundled sample into Learn and confirm the learn route and controller boot cleanly.
- Live mode entry: enter live from home, first interaction primes audio, no stuck-note or boot warning appears.
- Top-strip widgets: tracks, console, customize, and instrument controls all open and close correctly.
- Preference changes: theme, instrument, particle, locale, chord overlay, and pitch labels update immediately.
- Reload after preference changes: verify the previous preference state is restored after a full refresh.
- Session and export flows: session record toggle, loop controls, export modal open, and cancel/close all work.
- Console hygiene: no console errors during boot, route changes, modal open/close, and reload.

## Reviewer Notes
- Treat any runtime assertion as a blocker.
- Watch for duplicate overlays or duplicate event listeners after route changes.
- Verify the app still owns a single DOM mount root and no code recreates `#solid-root` imperatively.
