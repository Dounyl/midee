import { pathToRouteTarget, routeTargetToPath } from '@/stores/routing/routeTarget'

export function resolveInitialRoutePath(pathname: string): string {
  const target = pathToRouteTarget(pathname)
  if (target !== null) {
    return routeTargetToPath(target)
  }
  return '/play'
}
