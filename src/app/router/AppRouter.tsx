import { Route, Router, useLocation, useNavigate } from '@solidjs/router'
import { createEffect, lazy, onCleanup, type ParentProps, Suspense } from 'solid-js'
import {
  EXERCISE_ROUTE_PATHS,
  LEARN_HUB_PATH,
  LEGACY_EXERCISE_ROUTE_PATHS,
} from '@/features/routing/learnRoutes'
import { HomePage } from '@/pages/HomePage/HomePage'
import { SKIP_HOME_INTRO_STORAGE_KEY } from '@/stores/app/state'
import { resolveInitialRoutePath } from '@/stores/routing/modeRoutes'
import { bindAppNavigator, syncCurrentRoute } from '@/stores/routing/routerBridge'
import { type RouteTarget, routeTargetToPath } from '@/stores/routing/routeTarget'

const PlayPage = lazy(() =>
  import('@/pages/PlayPage/PlayPage').then((mod) => ({ default: mod.PlayPage })),
)
const LearnHubPage = lazy(() =>
  import('@/pages/LearnPage/LearnHubPage').then((mod) => ({ default: mod.LearnHubPage })),
)
const LearnPlayAlongPage = lazy(() =>
  import('@/pages/LearnPage/LearnPlayAlongPage').then((mod) => ({
    default: mod.LearnPlayAlongPage,
  })),
)
const LearnIntervalsPage = lazy(() =>
  import('@/pages/LearnPage/LearnIntervalsPage').then((mod) => ({
    default: mod.LearnIntervalsPage,
  })),
)
const LearnSightReadingPage = lazy(() =>
  import('@/pages/LearnPage/LearnSightReadingPage').then((mod) => ({
    default: mod.LearnSightReadingPage,
  })),
)
const LivePage = lazy(() =>
  import('@/pages/LivePage/LivePage').then((mod) => ({ default: mod.LivePage })),
)

function resolveBootPath(pathname: string): string {
  return resolveInitialRoutePath(
    pathname,
    localStorage.getItem(SKIP_HOME_INTRO_STORAGE_KEY) === 'true',
  )
}

function AppRouterRoot(props: ParentProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const unbind = bindAppNavigator(navigate)
  onCleanup(unbind)

  createEffect(() => {
    syncCurrentRoute(location.pathname)
  })

  return <Suspense fallback={null}>{props.children}</Suspense>
}

function LegacyHomeRedirect() {
  const navigate = useNavigate()
  createEffect(() => {
    navigate('/', { replace: true })
  })
  return null
}

function LegacyRouteRedirect(props: { target: RouteTarget }) {
  const navigate = useNavigate()
  createEffect(() => {
    navigate(routeTargetToPath(props.target), { replace: true })
  })
  return null
}

function RootRoute() {
  const navigate = useNavigate()
  const bootPath = resolveBootPath(window.location.pathname)

  createEffect(() => {
    if (bootPath !== '/') navigate(bootPath, { replace: true })
  })

  if (bootPath !== '/') return null
  return <HomePage />
}

function UnknownRouteRedirect() {
  const navigate = useNavigate()
  createEffect(() => {
    navigate(resolveBootPath(window.location.pathname), { replace: true })
  })
  return null
}

export function AppRouter() {
  return (
    <Router root={AppRouterRoot}>
      <Route path="/" component={RootRoute} />
      <Route path="/home" component={LegacyHomeRedirect} />
      <Route path="/play" component={PlayPage} />
      <Route path={LEARN_HUB_PATH} component={LearnHubPage} />
      <Route path={EXERCISE_ROUTE_PATHS['play-along']} component={LearnPlayAlongPage} />
      <Route path={EXERCISE_ROUTE_PATHS.intervals} component={LearnIntervalsPage} />
      <Route path={EXERCISE_ROUTE_PATHS['sight-reading']} component={LearnSightReadingPage} />
      <Route
        path={LEGACY_EXERCISE_ROUTE_PATHS['play-along']}
        component={() => (
          <LegacyRouteRedirect target={{ kind: 'exercise', routeId: 'play-along' }} />
        )}
      />
      <Route
        path={LEGACY_EXERCISE_ROUTE_PATHS.intervals}
        component={() => (
          <LegacyRouteRedirect target={{ kind: 'exercise', routeId: 'intervals' }} />
        )}
      />
      <Route
        path={LEGACY_EXERCISE_ROUTE_PATHS['sight-reading']}
        component={() => (
          <LegacyRouteRedirect target={{ kind: 'exercise', routeId: 'sight-reading' }} />
        )}
      />
      <Route path="/live" component={LivePage} />
      <Route path="*rest" component={UnknownRouteRedirect} />
    </Router>
  )
}
