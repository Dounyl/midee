import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import type { AppMode } from '@/stores/app/state'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import {
  modeToRouteTarget,
  pathToRouteTarget,
  routeTargetToMode,
  routeTargetToPath,
} from '@/stores/routing/routeTarget'

type NavigateFn = (to: string, options?: { replace?: boolean }) => void

let navigateImpl: NavigateFn | null = null
let currentRouteTarget: RouteTarget | null = null
const routeListeners = new Set<(mode: AppMode | null) => void>()

export function bindAppNavigator(navigate: NavigateFn): () => void {
  navigateImpl = navigate
  return () => {
    if (navigateImpl === navigate) navigateImpl = null
  }
}

export function syncCurrentRoute(pathname: string): void {
  currentRouteTarget = pathToRouteTarget(pathname)
  for (const listener of routeListeners) {
    listener(currentRouteTarget ? routeTargetToMode(currentRouteTarget) : null)
  }
}

export function getCurrentRouteTarget(): RouteTarget | null {
  if (currentRouteTarget) return currentRouteTarget
  if (typeof window === 'undefined') return null
  return pathToRouteTarget(window.location.pathname)
}

export function getCurrentRouteMode(): AppMode | null {
  const target = getCurrentRouteTarget()
  return target ? routeTargetToMode(target) : null
}

export function subscribeCurrentRoute(listener: (mode: AppMode | null) => void): () => void {
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

export function navigateToMode(mode: AppMode, options?: { replace?: boolean }): boolean {
  return navigateToTarget(modeToRouteTarget(mode), options)
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
