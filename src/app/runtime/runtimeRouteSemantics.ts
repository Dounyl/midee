import { setNextLiveOpts } from '@/pages/LivePage/liveEnterOptions'
import { isLearnRouteTarget, type RouteTarget } from '@/stores/routing/routeTarget'

export function resolveRuntimeTelemetryMode(target: RouteTarget | null): 'play' | 'live' | 'learn' {
  if (!target) return 'play'
  switch (target.kind) {
    case 'learn-hub':
    case 'exercise':
      return 'learn'
    default:
      return target.kind
  }
}

export function resolveRuntimeOpenTarget(
  target: RouteTarget | null,
  explicit?: 'play' | 'learn',
): 'play' | 'learn' {
  if (explicit) return explicit
  return isLearnRouteTarget(target) ? 'learn' : 'play'
}

export interface EnterLiveRouteOptions {
  primeAudio?: boolean
  navigate(target: RouteTarget): void
}

export function enterRuntimeLiveRoute(options: EnterLiveRouteOptions): void {
  const primeAudio = options.primeAudio ?? true
  setNextLiveOpts({ primeAudio })
  options.navigate({ kind: 'live' })
}
