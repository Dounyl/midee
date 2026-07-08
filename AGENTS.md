**Reality:** The product is **midee** (`package.json` → `"name": "midee"`). The repo directory on disk is often **`pianoroll`** — same codebase. Everything user-facing is a **static Vite SPA**: MIDI, audio, Pixi canvas, and MP4 export run in the **browser only**; there is no app server for core features (deploy is static assets + optional analytics keys).

## CodeGraph

**Use CodeGraph first** for code exploration. In repos with `.codegraph/` directory:

```bash
codegraph explore "symbol names or question"
```

Provides: verbatim source + line numbers + call paths (including dynamic dispatch). Faster and more accurate than grep/read loops. Skip if no `.codegraph/` directory.

## Commands (from `package.json`, repo root)

This repo is on `pnpm` (`package.json` → `"packageManager": "pnpm@11.7.0"`).

```bash
pnpm install
pnpm run dev         # vite → default http://localhost:5173
pnpm run check       # typecheck && biome check src && vitest run
pnpm run typecheck   # tsc --noEmit  (see tsconfig: include is src/** only)
pnpm run lint        # biome check src
pnpm run lint:fix    # biome check --write src
pnpm run format      # biome format --write src
pnpm run test        # vitest run  (jsdom; see vite.config.ts test.*)
pnpm run build       # tsc && vite build
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

### File Size Guidelines

**Why**: Large files are hard to understand, test, and review. They often signal mixed responsibilities.

**Recommended targets**:
- Component/Service files: ~400 lines
- Runtime/Orchestration files: ~500 lines
- Single function/method: <100 lines
- Constructor: <50 lines

**When to consider refactoring**: When a file's size makes it difficult to understand, test, or review, and there are clearly separable responsibilities.

**How to verify**:
```bash
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
```

### Naming Conventions

**Why**: Consistent naming reduces cognitive load and signals architectural patterns.

**Anti-patterns**:
- `*And*` in class names → signals mixed responsibility, split into separate classes
- `*Manager`, `*Helper`, `*Util` → too generic, find specific role name

**Patterns**:
- `*Coordinator` - orchestrates multiple services
- `*Factory` - creates instances
- `*Bridge` - adapts between interfaces
- `*Registry` - manages collection
- `Runtime*` prefix - runtime-scoped modules
- `create*` functions - factory functions
- `bootstrap*` functions - initialization with side effects
- `wire*` functions - event/handler binding

**How to verify**:
```bash
grep -rn "class.*And" src --include="*.ts"
grep -rn "class.*Manager\|class.*Helper\|class.*Util" src --include="*.ts"
```

## Runtime Boundaries

**Why**: Clear boundaries prevent feature state from leaking into shared runtime, keeping the codebase maintainable as it scales.

**How**: Treat the app as 4 layers: `Intent`, `Navigation/Application`, `Domain Runtime`, `Infrastructure`.

**How to verify**:
```bash
# Check for upward imports (services/features should not import from app/)
grep -rn "from '@/app" src/services src/features src/components
```
- Keep responsibilities narrow; do not let route parsing, business branching, and runtime state ownership collapse back into one class.

### Routing Rules

- `RouteTarget` is the only route-level business target model.
- Router code may translate `URL <-> RouteTarget`; business code should not infer behavior from raw path strings.
- Canonical routes are the source of truth; compatibility paths are redirect-only and must not become business-state inputs.

### Intent Rules

- `AppIntent` is the single entry for user/business flow dispatch.
- Components, coordinators, and services should express business transitions by dispatching intent, not by directly calling path-oriented helpers.
- New flows should be added at the intent layer first, then wired downward.

### Runtime Ownership

- Router owns the current `RouteTarget`.
- Application-layer orchestration owns one-shot handoff and runtime registration, not long-lived feature session state.
- Shared global state should hold only truly cross-page state.
- Page or feature runtime should own its own session state instead of pushing it upward into `AppRuntime`.
- Do not fake unsupported runtime capabilities with `null` or no-op methods.

### Learn Runtime Capability Rules

- Prefer explicit capability interfaces over one large runtime surface.
- Use `LearnRuntimeHandle` for lifecycle, and add optional capabilities only where they are truly implemented.
- If a runtime does not own a concern, it should not implement that capability.

### Composition Rules

**Why**: AppRuntime is a composition root, not a data owner. Keeping it narrow prevents it from becoming a God object.

**When to refactor**: If AppRuntime has fields named `*State`, `current*`, or holds feature-specific data, extract to specialized modules.

- `AppRuntime` is a composition root and wiring boundary, not the owner of ad-hoc learn state.
- Do not reintroduce feature-owned runtime state into `AppRuntime`.
- Do not keep widening shared dependency bags such as `AppRuntimeDeps`; prefer narrow ports grouped by responsibility.

**How to verify**:
```bash
# Check AppRuntime for state ownership violations
grep -n "private.*State\|private current" src/app/AppRuntime.ts
# Check for overly wide dependency bags (>10 properties)
grep -A 20 "interface.*Deps\|interface.*Options" src/app/runtime/*.ts | grep -c "^\s*[a-z]"
```
