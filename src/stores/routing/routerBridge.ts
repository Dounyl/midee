import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import { pathToRouteTarget, routeTargetToPath } from '@/stores/routing/routeTarget'

type NavigateFn = (to: string, options?: { replace?: boolean }) => void

let navigateImpl: NavigateFn | null = null
let currentRouteTarget: RouteTarget | null = null
const routeListeners = new Set<(target: RouteTarget | null) => void>()

export function bindAppNavigator(navigate: NavigateFn): () => void {
  navigateImpl = navigate
  return () => {
    if (navigateImpl === navigate) navigateImpl = null
  }
}

export function syncCurrentRoute(pathname: string): void {
  currentRouteTarget = pathToRouteTarget(pathname)
  for (const listener of routeListeners) {
    listener(currentRouteTarget)
  }
}

export function getCurrentRouteTarget(): RouteTarget | null {
  if (currentRouteTarget) return currentRouteTarget
  if (typeof window === 'undefined') return null
  return pathToRouteTarget(window.location.pathname)
}

export function subscribeCurrentRoute(listener: (target: RouteTarget | null) => void): () => void {
  routeListeners.add(listener)
  return () => {
    routeListeners.delete(listener)
  }
}

export function navigateToTarget(target: RouteTarget, options?: { replace?: boolean }): boolean {
  if (!navigateImpl) return false
  navigateImpl(routeTargetToPath(target), options)
  return true
}

export function navigateToLearnHub(options?: { replace?: boolean }): boolean {
  return navigateToTarget({ kind: 'learn-hub' }, options)
}

export function navigateToExerciseRoute(
  routeId: ExerciseRouteId,
  options?: { replace?: boolean },
): boolean {
  return navigateToTarget({ kind: 'exercise', routeId }, options)
}
