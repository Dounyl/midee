import { Route, Router, useLocation, useNavigate } from '@solidjs/router'
import { createEffect, onCleanup, type ParentProps } from 'solid-js'
import { HomePage } from '../pages/home/HomePage'
import { LearnHubPage } from '../pages/learn/LearnHubPage'
import { LearnIntervalsPage } from '../pages/learn/LearnIntervalsPage'
import { LearnPlayAlongPage } from '../pages/learn/LearnPlayAlongPage'
import { LearnSightReadingPage } from '../pages/learn/LearnSightReadingPage'
import { LivePage } from '../pages/live/LivePage'
import { PlayPage } from '../pages/play/PlayPage'
import { resolveInitialRoutePath } from '../routing/modeRoutes'
import { bindAppNavigator, syncCurrentRoute } from '../routing/routerBridge'
import { SKIP_HOME_INTRO_STORAGE_KEY } from '../store/state'

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

  return <>{props.children}</>
}

function LegacyHomeRedirect() {
  const navigate = useNavigate()
  createEffect(() => {
    navigate('/', { replace: true })
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
      <Route path="/learn" component={LearnHubPage} />
      <Route path="/learn/play-along" component={LearnPlayAlongPage} />
      <Route path="/learn/intervals" component={LearnIntervalsPage} />
      <Route path="/learn/sight-reading" component={LearnSightReadingPage} />
      <Route path="/live" component={LivePage} />
      <Route path="*rest" component={UnknownRouteRedirect} />
    </Router>
  )
}
