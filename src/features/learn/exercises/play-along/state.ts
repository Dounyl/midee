import type { LoopRegion } from '@/features/learn/engines/LoopRegion'

export type PlayAlongHandFilter = 'left' | 'right' | 'both'

export interface PlayAlongPreferences {
  waitEnabled: boolean
  tempoRampEnabled: boolean
  speedPct: number
  hand: PlayAlongHandFilter
}

export interface PlayAlongReplayState {
  loopRegion: LoopRegion | null
  startTime: number
  autoplay?: boolean
}

interface StoredPlayAlongState {
  prefs?: Partial<PlayAlongPreferences>
  replay?: PlayAlongReplayState | null
}

const STORAGE_KEY = 'midee.learn.playAlong.state.v1'

export const DEFAULT_PLAY_ALONG_PREFERENCES: PlayAlongPreferences = {
  waitEnabled: true,
  tempoRampEnabled: false,
  speedPct: 100,
  hand: 'both',
}

export function readPlayAlongPreferences(): PlayAlongPreferences {
  const stored = readStoredState()
  const prefs = stored?.prefs
  return {
    waitEnabled: typeof prefs?.waitEnabled === 'boolean' ? prefs.waitEnabled : true,
    tempoRampEnabled: typeof prefs?.tempoRampEnabled === 'boolean' ? prefs.tempoRampEnabled : false,
    speedPct: normalizeSpeedPct(prefs?.speedPct),
    hand: normalizeHand(prefs?.hand),
  }
}

export function writePlayAlongPreferences(prefs: PlayAlongPreferences): void {
  writeStoredState({
    ...readStoredState(),
    prefs: {
      waitEnabled: prefs.waitEnabled,
      tempoRampEnabled: prefs.tempoRampEnabled,
      speedPct: normalizeSpeedPct(prefs.speedPct),
      hand: normalizeHand(prefs.hand),
    },
  })
}

export function stagePlayAlongReplayState(replay: PlayAlongReplayState | null): void {
  writeStoredState({
    ...readStoredState(),
    replay,
  })
}

export function consumePlayAlongReplayState(): PlayAlongReplayState | null {
  const stored = readStoredState()
  const replay = normalizeReplay(stored?.replay)
  if (!stored?.replay) return null
  writeStoredState({
    ...stored,
    replay: null,
  })
  return replay
}

function readStoredState(): StoredPlayAlongState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPlayAlongState
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeStoredState(next: StoredPlayAlongState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Best-effort persistence only.
  }
}

function normalizeSpeedPct(value: unknown): number {
  return value === 60 || value === 80 || value === 100 ? value : 100
}

function normalizeHand(value: unknown): PlayAlongHandFilter {
  return value === 'left' || value === 'right' || value === 'both' ? value : 'both'
}

function normalizeReplay(replay: unknown): PlayAlongReplayState | null {
  if (!replay || typeof replay !== 'object') return null
  const maybeReplay = replay as {
    loopRegion?: { start?: unknown; end?: unknown }
    startTime?: unknown
    autoplay?: unknown
  }
  const startTime = maybeReplay.startTime
  if (typeof startTime !== 'number' || !Number.isFinite(startTime)) {
    return null
  }
  const start = maybeReplay.loopRegion?.start
  const end = maybeReplay.loopRegion?.end
  const loopRegion =
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start
      ? { start, end }
      : null
  return {
    loopRegion,
    startTime,
    autoplay: maybeReplay.autoplay !== false,
  }
}
