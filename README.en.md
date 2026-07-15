# midee

简体中文: [README.md](./README.md)

`midee` is a browser-native MIDI visualizer, live-play, practice, and export tool.

Live site:
[http://139.196.37.239/](http://139.196.37.239/)

GitHub:
[https://github.com/Dounyl/midee](https://github.com/Dounyl/midee)

## Project origin

This repository is a fork of the upstream project:

- Upstream: `aayushdutt/midee`
- Current repository: `Dounyl/midee`

We have authorization from the original author to continue development, adaptation, and publication based on that work.

This repository will keep evolving in its own direction. Over time, its features, structure, docs, and deployment may diverge significantly from upstream, so it should not be treated as a mirror of the original project.

## Current position

`midee` is still a static Vite SPA. Its core capabilities run in the browser, including:

- MIDI loading and playback
- audio synthesis and live input
- Pixi-based rendering
- guided practice flows
- MP4 / MIDI export

In other words, this is not a traditional server-driven app for its core product behavior.

## Main features

### MIDI visualization

- Load and play MIDI files with multi-track rendering
- Falling-note piano roll, glowing keys, particles, and chord feedback
- Full 88-key keyboard view
- New 61-key mode for compact keyboards and tighter screen layouts
- Transpose while paused, with the displayed key updated accordingly
- Solfege / note-name labels on both notes and keyboard
- Theme, particles, instruments, labels, viewport, and export-view customization
- A recent local MIDI library and recent-practice entry points, with up to 20 local files retained

### Live play

- Web MIDI controller support
- Computer keyboard input
- Clickable on-screen piano interaction
- Real-time visualization, recording, and replay-oriented workflows
- Metronome support
- Interactive live performance mode in the browser

### Looping and recording

- Loop-station style phrase capture
- Overdub, undo, and clear flows
- Bar-snapped looping workflow
- Export recorded ideas as `.mid`
- Reuse recorded sessions in the export pipeline

### Learn mode

- `Play along`
- `Sight Reading`
- `Intervals`

`Play along` includes a guided practice flow:

- choose a guided mode before starting a pass
- `Demo` mode keeps the guided accompaniment audible
- `Practice` mode reduces the audible material based on hand focus, making real practice more intentional
- `Wait mode` pauses on key chords until you play the expected notes
- hand focus, looped sections, and tempo/speed control
- run summaries and replay/continue practice flow

`Sight Reading` currently also includes:

- treble / bass / both-clef switching
- tempo ramp, note-gap control, restart, and weak-spot-oriented practice controls

`Intervals` currently includes:

- listen-and-answer interval training flow
- streaks, feedback, and replay

### Export

- Local in-browser MP4 export
- 720p, 1080p, vertical, square, and related output presets
- Audio, video, and MIDI export options
- Export remains primarily browser-side

## Stack

- `SolidJS`
- `TypeScript`
- `Vite`
- `PixiJS`
- `Tone.js`
- `@tonejs/midi`
- `Web MIDI`
- `WebCodecs`

## Development

The project now uses `pnpm` consistently.

Recommended environment:

- Node.js 24
- pnpm 11+

Install and start:

```bash
pnpm install
pnpm run dev
```

Local dev URL:

```text
http://localhost:5173/
```

Common commands:

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run typecheck
pnpm run lint
pnpm run lint:fix
pnpm run format
pnpm run test
pnpm run check
```

## License

The project is currently maintained under MIT terms. If you plan to redistribute or commercialize it further, also verify the top-level license file and any third-party asset licenses used in the repository.
