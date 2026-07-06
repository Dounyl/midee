export type ExerciseRouteId = 'play-along' | 'intervals' | 'sight-reading'

export const LEARN_HUB_PATH = '/learn'

export const EXERCISE_ROUTE_PATHS: Record<ExerciseRouteId, string> = {
  'play-along': '/learn/play-along',
  intervals: '/learn/intervals',
  'sight-reading': '/learn/sight-reading',
}

export const LEGACY_EXERCISE_ROUTE_PATHS: Record<ExerciseRouteId, string> = {
  'play-along': '/play-along',
  intervals: '/ear-training/intervals',
  'sight-reading': '/sight-reading',
}

function normalizePath(pathname: string): string {
  return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
}

function matchExerciseRoute(
  pathname: string,
  routes: Record<ExerciseRouteId, string>,
): ExerciseRouteId | null {
  const normalized = normalizePath(pathname)
  for (const [route, path] of Object.entries(routes) as Array<[ExerciseRouteId, string]>) {
    if (normalized === path) return route
  }
  return null
}

export function exerciseRouteToPath(route: ExerciseRouteId): string {
  return EXERCISE_ROUTE_PATHS[route]
}

export function pathToExerciseRoute(pathname: string): ExerciseRouteId | null {
  return matchExerciseRoute(pathname, EXERCISE_ROUTE_PATHS)
}

export function pathToLegacyExerciseRoute(pathname: string): ExerciseRouteId | null {
  return matchExerciseRoute(pathname, LEGACY_EXERCISE_ROUTE_PATHS)
}

export function isLearnHubPath(pathname: string): boolean {
  return normalizePath(pathname) === LEARN_HUB_PATH
}
