import type { AppMode } from '@/stores/app/state'

export const MODE_CAPTURES_LIVE: Record<AppMode, boolean> = {
  home: true,
  play: true,
  live: true,
  learn: false,
}
