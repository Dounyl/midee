import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import {
  exerciseRouteToPath,
  isLearnHubPath,
  pathToExerciseRoute,
  pathToLegacyExerciseRoute,
} from '@/features/routing/learnRoutes'
import type { AppMode } from '@/stores/app/state'

export type RouteTarget =
  | { kind: 'home' }
  | { kind: 'play' }
  | { kind: 'live' }
  | { kind: 'learn-hub' }
  | { kind: 'exercise'; routeId: ExerciseRouteId }

function normalizePath(pathname: string): string {
  return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
}

export function routeTargetToPath(target: RouteTarget): string {
  switch (target.kind) {
    case 'home':
      return '/'
    case 'play':
      return '/play'
    case 'live':
      return '/live'
    case 'learn-hub':
      return '/learn'
    case 'exercise':
      return exerciseRouteToPath(target.routeId)
  }
}

export function routeTargetToMode(target: RouteTarget): AppMode {
  switch (target.kind) {
    case 'home':
      return 'home'
    case 'play':
      return 'play'
    case 'live':
      return 'live'
    case 'learn-hub':
    case 'exercise':
      return 'learn'
  }
}

export function modeToRouteTarget(mode: AppMode): RouteTarget {
  switch (mode) {
    case 'home':
      return { kind: 'home' }
    case 'play':
      return { kind: 'play' }
    case 'live':
      return { kind: 'live' }
    case 'learn':
      return { kind: 'learn-hub' }
  }
}

export function pathToRouteTarget(pathname: string): RouteTarget | null {
  const normalized = normalizePath(pathname)
  if (normalized === '/') return { kind: 'home' }
  if (normalized === '/play') return { kind: 'play' }
  if (normalized === '/live') return { kind: 'live' }
  if (isLearnHubPath(normalized)) return { kind: 'learn-hub' }
  const canonicalExercise = pathToExerciseRoute(normalized)
  if (canonicalExercise) return { kind: 'exercise', routeId: canonicalExercise }
  const legacyExercise = pathToLegacyExerciseRoute(normalized)
  if (legacyExercise) return { kind: 'exercise', routeId: legacyExercise }
  return null
}

export function isLegacyRouteTargetPath(pathname: string): boolean {
  return pathToLegacyExerciseRoute(normalizePath(pathname)) !== null
}
