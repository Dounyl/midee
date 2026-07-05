**Reality:** The product is **midee** (`package.json` → `"name": "midee"`). The repo directory on disk is often **`pianoroll`** — same codebase. Everything user-facing is a **static Vite SPA**: MIDI, audio, Pixi canvas, and MP4 export run in the **browser only**; there is no app server for core features (deploy is static assets + optional analytics keys).

## Commands (from `package.json`, repo root)

```bash
npm install
npm run dev          # vite → default http://localhost:5173
npm run check        # typecheck && biome check src && vitest run
npm run typecheck    # tsc --noEmit  (see tsconfig: include is src/** only)
npm run lint         # biome check src
npm run lint:fix     # biome check --write src
npm run format       # biome format --write src
npm run test         # vitest run  (jsdom; see vite.config.ts test.*)
npm run build        # tsc && vite build
# postbuild (automatic after build): node scripts/build-content.mjs, build-og.mjs,
# stamp-sitemap.mjs, check-links.mjs — static content / SEO, not runtime app logic
```
## Source Tree

The canonical source layout under `src/` is:

```text
src/
  app/         # app bootstrapping, top-level runtime orchestration, router wiring
  pages/       # page shells / route-level page composition
  components/  # reusable UI components
  features/    # feature-specific business logic and feature-local UI/runtime pieces
  stores/      # app/store context, state containers, store helpers
  services/    # runtime/browser services: audio, midi, renderer, export, input
  lib/         # shared non-UI utilities and domain logic
  types/       # shared types
  i18n/        # translations and locale bootstrapping
  styles/      # global styles
  test/        # shared test helpers
```

### Placement Rules

- Put new app entry / boot / provider / router composition code in `src/app/`.
- Put route/page shells in `src/pages/`.
- Put reusable view components in `src/components/`.
- Put feature logic in `src/features/`.
- Put state containers and context in `src/stores/`.
- Put browser/runtime services in `src/services/`.
- Put shared logic with no UI responsibility in `src/lib/`.
- Put shared type definitions in `src/types/`.

### Current Grouping

- `src/components/common/` = cross-feature UI primitives and helpers.
- `src/components/playback/` = playback/live/play-mode UI.
- `src/components/export/` = export/session/modal UI.
- `src/components/learn/` = learn-specific reusable UI.
- `src/features/learn/` = learn engines, exercises, overlays, hub logic, and feature-local UI.

### Legacy Compatibility Directories

The following directories may still exist during migration, but they are compatibility layers and should not receive new source files unless the task is specifically migration cleanup:

- `src/audio/`
- `src/core/`
- `src/export/`
- `src/learn/`
- `src/midi/`
- `src/renderer/`
- `src/store/`
- `src/ui/`
- old lowercase page paths like `src/pages/home/`, `src/pages/play/`, `src/pages/live/`, `src/pages/learn/`

### Working Rule

- Prefer imports from canonical directories and `@/` aliases.
- Prefer moving or adding real code under `app/components/features/stores/services/lib/types`.
- Avoid creating new compatibility shims unless needed to keep the build green during migration.
