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
