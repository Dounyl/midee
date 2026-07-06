import type { AppMode } from '@/stores/app/state'
import {
  pathToRouteTarget,
  routeTargetToMode,
  routeTargetToPath,
} from '@/stores/routing/routeTarget'

export const MODE_PATHS: Record<AppMode, string> = {
  home: '/',
  play: '/play',
  live: '/live',
  learn: '/learn',
}

export function modeToPath(mode: AppMode): string {
  return MODE_PATHS[mode]
}

export function pathToMode(pathname: string): AppMode | null {
  const target = pathToRouteTarget(pathname)
  return target ? routeTargetToMode(target) : null
}

export function resolveInitialRoutePath(pathname: string, skipHomeIntro: boolean): string {
  const target = pathToRouteTarget(pathname)
  if (target !== null) {
    if (target.kind === 'home' && skipHomeIntro) return MODE_PATHS.play
    return routeTargetToPath(target)
  }
  return skipHomeIntro ? MODE_PATHS.play : MODE_PATHS.home
}
