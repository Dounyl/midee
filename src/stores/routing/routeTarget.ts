import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import {
  exerciseRouteToPath,
  isLearnHubPath,
  pathToExerciseRoute,
  pathToLegacyExerciseRoute,
} from '@/features/routing/learnRoutes'

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

export function isHomeRouteTarget(target: RouteTarget | null): boolean {
  return target?.kind === 'home'
}

export function isPlayRouteTarget(target: RouteTarget | null): boolean {
  return target?.kind === 'play'
}

export function isLiveRouteTarget(target: RouteTarget | null): boolean {
  return target?.kind === 'live'
}

export function isLearnRouteTarget(target: RouteTarget | null): boolean {
  return target?.kind === 'learn-hub' || target?.kind === 'exercise'
}

export function routeCapturesLive(target: RouteTarget | null): boolean {
  return !isLearnRouteTarget(target)
}
