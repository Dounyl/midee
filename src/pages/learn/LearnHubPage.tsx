import { useNavigate } from '@solidjs/router'
import { createMemo, For, onCleanup, onMount } from 'solid-js'
import { t } from '../../i18n'
import { createLearnProgressStore } from '../../learn/core/progress'
import { LEARN_ROUTE_CATALOG, type LearnRouteEntry } from '../../learn/hub/catalog'
import '../../learn/hub/LearnHub.css'
import { ExerciseCardView } from '../../learn/ui/ExerciseCard'
import { StreakRowView } from '../../learn/ui/StreakRow'
import { useApp } from '../../store/AppCtx'
import { LearnLayout } from './LearnLayout'

const CATEGORY_ORDER = ['ear-training', 'sight-reading'] as const

const CATEGORY_ICON: Record<LearnRouteEntry['category'], string> = {
  'play-along':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M12 6v10M17 8v6"/></svg>',
  'sight-reading':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 11h16M4 16h10"/><circle cx="18" cy="16" r="2"/></svg>',
  'ear-training':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18a5 5 0 0 1 0-10 3 3 0 1 1 6 0v10"/><path d="M14 14h4"/></svg>',
  theory:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>',
  technique:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l5-10 3 6 3-12 5 16"/></svg>',
  reflection:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
}

export function LearnHubPage() {
  const { actions } = useApp()
  const navigate = useNavigate()
  const progress = createLearnProgressStore()

  onMount(() => {
    const abort = new AbortController()
    void actions.learn.enterRoute('hub', abort.signal)
    onCleanup(() => {
      abort.abort()
      actions.learn.exitRoute()
    })
  })

  const featured = createMemo(
    () => LEARN_ROUTE_CATALOG.find((entry) => entry.id === 'play-along') ?? null,
  )
  const grouped = createMemo(() => {
    const map = new Map<LearnRouteEntry['category'], LearnRouteEntry[]>()
    for (const entry of LEARN_ROUTE_CATALOG) {
      if (entry.id === 'play-along') continue
      const list = map.get(entry.category) ?? []
      list.push(entry)
      map.set(entry.category, list)
    }
    return map
  })

  return (
    <LearnLayout variant="hub">
      <div class="learn-hub">
        <div class="learn-hub__glow" aria-hidden="true" />
        <header class="learn-hub__topbar">
          <div class="learn-hub__streak">
            <StreakRowView progress={progress} />
          </div>
        </header>
        <div class="learn-hub__scroll">
          <div class="learn-hub__inner">
            {featured() ? (
              <section class="learn-hub__hero">
                <button
                  type="button"
                  class="hero-card"
                  data-category={featured()!.category}
                  onClick={() => navigate(featured()!.route)}
                >
                  <div class="hero-card__badge" innerHTML={CATEGORY_ICON[featured()!.category]} />
                  <div class="hero-card__body">
                    <span class="hero-card__kicker">{t('learn.hub.recommended')}</span>
                    <h2 class="hero-card__title">{featured()!.title}</h2>
                    <p class="hero-card__blurb">{featured()!.blurb}</p>
                  </div>
                </button>
              </section>
            ) : null}

            <section class="learn-hub__grid-section">
              <div class="learn-hub__grid-label">{t('learn.hub.explore')}</div>
              <div class="learn-hub__grid-cards">
                <For each={CATEGORY_ORDER.flatMap((category) => grouped().get(category) ?? [])}>
                  {(entry) => (
                    <ExerciseCardView
                      descriptor={entry}
                      icon={CATEGORY_ICON[entry.category]}
                      onLaunch={() => navigate(entry.route)}
                    />
                  )}
                </For>
              </div>
            </section>
          </div>
        </div>
      </div>
    </LearnLayout>
  )
}
