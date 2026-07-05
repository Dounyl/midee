import type { AppMode } from '@/stores/app/state'
import { type LearnRouteId, learnRouteToPath, pathToLearnRoute } from './learnRoutes'
import { modeToPath, pathToMode } from './modeRoutes'

type NavigateFn = (to: string, options?: { replace?: boolean }) => void

let navigateImpl: NavigateFn | null = null
let currentRouteMode: AppMode | null = null
const routeListeners = new Set<(mode: AppMode | null) => void>()

export function bindAppNavigator(navigate: NavigateFn): () => void {
  navigateImpl = navigate
  return () => {
    if (navigateImpl === navigate) navigateImpl = null
  }
}

export function syncCurrentRoute(pathname: string): void {
  currentRouteMode = pathToMode(pathname)
  for (const listener of routeListeners) listener(currentRouteMode)
}

export function getCurrentRouteMode(): AppMode | null {
  if (currentRouteMode) return currentRouteMode
  if (typeof window === 'undefined') return null
  return pathToMode(window.location.pathname)
}

export function getCurrentLearnRoute(): LearnRouteId | null {
  if (typeof window === 'undefined') return null
  return pathToLearnRoute(window.location.pathname)
}

export function subscribeCurrentRoute(listener: (mode: AppMode | null) => void): () => void {
  routeListeners.add(listener)
  return () => {
    routeListeners.delete(listener)
  }
}

export function navigateToMode(mode: AppMode, options?: { replace?: boolean }): boolean {
  if (!navigateImpl) return false
  navigateImpl(modeToPath(mode), options)
  return true
}

export function navigateToLearnRoute(
  route: LearnRouteId,
  options?: { replace?: boolean },
): boolean {
  if (!navigateImpl) return false
  navigateImpl(learnRouteToPath(route), options)
  return true
}
