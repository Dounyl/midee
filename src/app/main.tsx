import '@/styles/global.css'
// Self-hosted fonts via @fontsource. Each CSS import emits a `@font-face`
// rule into the main stylesheet bundle and ships its woff2 file to
// `dist/assets/` as a long-cacheable hashed asset. Compared to
// fonts.googleapis.com + fonts.gstatic.com, this saves the cross-origin
// DNS+TLS chain Lighthouse measures as ~360 ms render-blocking on first
// load. The bundled `latin-` subsets cover the Latin-script locales we ship;
// `zh-CN` falls back to system CJK fonts via CSS.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/instrument-serif/latin-400.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import { render } from 'solid-js/web'
import { AppShell } from '@/app/AppShell'
import { env } from '@/app/env'
import type { AppRuntimeInstance } from '@/app/runtime/types'
import { currentLocaleNativeName, initI18n, shouldShowLocaleHint, t } from '@/i18n'
import { whenIdle } from '@/lib/whenIdle'
import localeHintStyles from '@/main/LocaleHint.module.css'
import { loadPostHog, registerAnalyticsContext } from '@/services/telemetry'

// Both analytics SDKs are loaded on idle so they don't sit in the initial
// bundle. PostHog alone is ~70 KB gz with autocapture / session_recording /
// feature_flags; @vercel/analytics is small but still a deferrable import.
// Buffered events fire once the SDK lands - see telemetry.ts -> `loadPostHog`.
const posthogKey = env.VITE_POSTHOG_KEY
if (posthogKey) {
  // Snapshot context props at boot time even though the SDK isn't loaded
  // yet - they get queued and replayed in order on first init.
  registerAnalyticsContext()
}
whenIdle(() => {
  if (posthogKey) {
    void loadPostHog(posthogKey, {
      api_host: env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      defaults: '2026-01-30',
      person_profiles: 'always',
    })
  }
  void import('@vercel/analytics').then(({ inject }) => inject())
})

// Load the right locale before constructing UI so the first paint is already
// translated - avoids an English-then-French flash. Adds ~5-15ms for the
// dynamic import on non-English; English is bundled and resolves instantly.
async function boot(): Promise<void> {
  await initI18n()
  const mount = document.querySelector<HTMLElement>('#app')
  if (!mount) throw new Error('App failed to initialize: missing #app mount root')
  render(
    () => (
      <AppShell
        onReady={() => {
          if (shouldShowLocaleHint()) showLocaleHint()
        }}
        onRuntimeReady={(runtime) => {
          void runBenchIfEnabled(runtime)
        }}
        onError={(err) => {
          console.error('App failed to initialize:', err)
        }}
      />
    ),
    mount,
  )
}

async function runBenchIfEnabled(runtime: AppRuntimeInstance): Promise<void> {
  // Bench runner is a build-time opt-in. `npm run bench` sets
  // VITE_ENABLE_BENCH=1; public prod builds don't, so Vite constant-folds the
  // condition to `false` and tree-shakes both the dynamic import and the
  // branch - `bench/runner.ts` never reaches the public bundle, and
  // `?bench=...` URLs are inert in prod. Read `import.meta.env` directly (not
  // through env.ts) so the value is statically inlined for the dead-code pass.
  if (!import.meta.env.VITE_ENABLE_BENCH) return
  const { benchFixtureFromUrl, runBench } = await import('@/bench/runner')
  const fixture = benchFixtureFromUrl()
  if (!fixture) return
  try {
    window.__BENCH_RESULT = await runBench(fixture, runtime.bench)
  } catch (err) {
    window.__BENCH_ERROR = err instanceof Error ? err.message : String(err)
    console.error('[bench]', err)
  }
}

function showLocaleHint(): void {
  const el = document.createElement('div')
  el.className = localeHintStyles.localeHint!
  const closeClass = localeHintStyles.localeHintClose!
  el.innerHTML = `
    <span>${t('onboarding.localeDetected', { language: currentLocaleNativeName() })}</span>
    <button class="${closeClass}" type="button" aria-label="${escapeAttr(t('coachmark.dismiss'))}">×</button>
  `
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add(localeHintStyles.localeHintShown!))
  const dismiss = (): void => {
    el.classList.remove(localeHintStyles.localeHintShown!)
    setTimeout(() => el.remove(), 400)
  }
  el.querySelector<HTMLButtonElement>(`.${closeClass}`)?.addEventListener('click', dismiss)
  setTimeout(dismiss, 8000)
}

// Translated strings can carry quotes; encode for safe interpolation into
// an HTML attribute. Locale-hint copy is the only place we touch innerHTML
// with translated content.
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

void boot().catch((err) => {
  console.error('App failed to initialize:', err)
})
