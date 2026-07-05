export type LearnRouteId = 'hub' | 'play-along' | 'intervals' | 'sight-reading'

export const LEARN_ROUTE_PATHS: Record<LearnRouteId, string> = {
  hub: '/learn',
  'play-along': '/learn/play-along',
  intervals: '/learn/intervals',
  'sight-reading': '/learn/sight-reading',
}

export function learnRouteToPath(route: LearnRouteId): string {
  return LEARN_ROUTE_PATHS[route]
}

export function pathToLearnRoute(pathname: string): LearnRouteId | null {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  switch (normalized) {
    case '/learn':
      return 'hub'
    case '/learn/play-along':
      return 'play-along'
    case '/learn/intervals':
      return 'intervals'
    case '/learn/sight-reading':
      return 'sight-reading'
    default:
      return null
  }
}
