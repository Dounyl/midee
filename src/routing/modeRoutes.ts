import type { AppMode } from '@/stores/app/state'
import { pathToLearnRoute } from './learnRoutes'

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
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  if (normalized === '/') return 'home'
  if (pathToLearnRoute(normalized)) return 'learn'
  for (const [mode, path] of Object.entries(MODE_PATHS) as Array<[AppMode, string]>) {
    if (path !== '/' && normalized === path) return mode
  }
  return null
}

export function resolveInitialRoutePath(pathname: string, skipHomeIntro: boolean): string {
  const matchedMode = pathToMode(pathname)
  if (matchedMode && matchedMode !== 'home') return modeToPath(matchedMode)
  if (matchedMode === 'home') return skipHomeIntro ? MODE_PATHS.play : MODE_PATHS.home
  return skipHomeIntro ? MODE_PATHS.play : MODE_PATHS.home
}
