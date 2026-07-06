import { pathToRouteTarget, routeTargetToPath } from '@/stores/routing/routeTarget'

export function resolveInitialRoutePath(pathname: string, skipHomeIntro: boolean): string {
  const target = pathToRouteTarget(pathname)
  if (target !== null) {
    if (target.kind === 'home' && skipHomeIntro) return '/play'
    return routeTargetToPath(target)
  }
  return skipHomeIntro ? '/play' : '/'
}
