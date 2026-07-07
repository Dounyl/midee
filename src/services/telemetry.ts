import type { PostHog, PostHogConfig } from 'posthog-js'

// Thin wrapper around posthog-js + a typed event registry. Kept as a single
// flat file (not `src/analytics/*`) because common ad blockers treat
// `/analytics/` paths as trackers and block them outright — during Vite dev
// that means blank module loads and cryptic import errors. The file has also
// been renamed away from `analytics.ts` to avoid the same heuristic.
//
// Event-name convention: snake_case, past tense. Don't rename existing event
// names without dual-firing for at least two weeks (see play_mode_entered /
// file_mode_entered for the pattern).
//
// posthog-js is dynamic-imported on idle (see `loadPostHog`) so it doesn't
// block the initial bundle (~70 KB gz at the time of writing). Calls made
// before the SDK loads are queued and replayed in-order on `loadPostHog`.

let ph: PostHog | null = null
let phLoadFailed = false
const queue: Array<(client: PostHog) => void> = []

function enqueue(fn: (client: PostHog) => void): void {
  if (ph) fn(ph)
  else if (!phLoadFailed) queue.push(fn)
}

export async function loadPostHog(key: string, config: Partial<PostHogConfig>): Promise<void> {
  try {
    const mod = await import('posthog-js')
    mod.default.init(key, config)
    ph = mod.default
    for (const fn of queue) fn(ph)
    queue.length = 0
  } catch (err) {
    phLoadFailed = true
    queue.length = 0
    console.warn('[telemetry] posthog-js failed to load', err)
  }
}

export function track(event: string, properties?: Record<string, unknown>): void {
  enqueue((client) => client.capture(event, properties))
}

const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()
export function trackSettled(event: string, properties: Record<string, unknown>, ms = 600): void {
  const prev = settleTimers.get(event)
  if (prev) clearTimeout(prev)
  settleTimers.set(
    event,
    setTimeout(() => {
      settleTimers.delete(event)
      track(event, properties)
    }, ms),
  )
}

export function trackMidiLoaded(p: {
  source: 'drag' | 'picker' | 'sample'
  target?: 'play' | 'learn'
  trackCount: number
  noteCount: number
  durationS: number
  fileSizeKb?: number | null
  sampleId?: string | null
}): void {
  track('midi_loaded', {
    source: p.source,
    target: p.target ?? 'play',
    track_count: p.trackCount,
    note_count: p.noteCount,
    duration_s: p.durationS,
    file_size_kb: p.fileSizeKb ?? null,
    sample_id: p.sampleId ?? null,
  })
}

export type MidiLoadErrorType = 'empty' | 'not_midi' | 'parse'

export async function midiLoadErrorType(err: unknown, file: File): Promise<MidiLoadErrorType> {
  if (err instanceof Error && err.name === 'EmptyMidiError') return 'empty'
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    if (String.fromCharCode(...head) !== 'MThd') return 'not_midi'
  } catch {}
  return 'parse'
}

export function trackMidiLoadFailed(p: {
  source: string
  target?: 'play' | 'learn'
  errorType: MidiLoadErrorType
  fileExt?: string | null
  fileSizeKb?: number | null
}): void {
  track('midi_load_failed', {
    source: p.source,
    target: p.target ?? 'play',
    error_type: p.errorType,
    file_ext: p.fileExt ?? null,
    file_size_kb: p.fileSizeKb ?? null,
  })
}

export function registerAnalyticsContext(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  const deviceType = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
  const pointer = window.matchMedia?.('(pointer: coarse)').matches ? 'coarse' : 'fine'
  const orientation = window.matchMedia?.('(orientation: portrait)').matches
    ? 'portrait'
    : 'landscape'
  const isPwa = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const url = new URL(window.location.href)
  const landingPath = url.pathname
  const landingReferrer = document.referrer || '(direct)'
  const landingUtmSource = url.searchParams.get('utm_source') ?? null
  const landingUtmMedium = url.searchParams.get('utm_medium') ?? null
  const landingUtmCampaign = url.searchParams.get('utm_campaign') ?? null

  enqueue((client) => {
    client.register({
      device_type: deviceType,
      pointer,
      orientation,
      is_pwa: isPwa,
      viewport_w: w,
      viewport_h: h,
    })
    client.register_once({
      landing_path: landingPath,
      landing_referrer: landingReferrer,
      landing_utm_source: landingUtmSource,
      landing_utm_medium: landingUtmMedium,
      landing_utm_campaign: landingUtmCampaign,
    })
  })
}

const ACTIVATED_KEY = 'midee.activated'
export function trackActivation(trigger: 'playback_30s' | 'live_note' | 'export_started'): void {
  try {
    if (localStorage.getItem(ACTIVATED_KEY)) return
    localStorage.setItem(ACTIVATED_KEY, '1')
  } catch {}
  enqueue((client) => client.capture('user_activated', { trigger }))
}

const MIDI_VENDORS = [
  'korg',
  'akai',
  'roland',
  'yamaha',
  'arturia',
  'novation',
  'nektar',
  'native instruments',
  'm-audio',
  'alesis',
  'casio',
  'presonus',
] as const
export function categorizeMidiDevice(name: string): string {
  const lower = name.toLowerCase()
  for (const v of MIDI_VENDORS) if (lower.includes(v)) return v
  return 'other'
}

type EventMap = {
  play_mode_entered: { duration_s: number }
  live_mode_entered: { midi_connected: boolean }
  learn_mode_entered: { from_route_kind: 'play' | 'live' | 'learn-hub' | 'exercise' }
  exercise_started: { exercise_id: string; category: string; difficulty: string }
  exercise_completed: {
    exercise_id: string
    duration_s: number
    accuracy: number
    xp: number
    completed: boolean
  }
  exercise_abandoned: { exercise_id: string; duration_s: number }
  exercise_summary_action: {
    exercise_id: string
    action: 'again' | 'next' | 'dismissed'
  }
  feedback_clicked: { source: 'customize_menu' | 'post_session' }
  seeked: { from_s: number; to_s: number; method: 'scrub' | 'skip' }
  playback_paused: { position_s: number; position_pct: number }
  speed_changed: { speed: number }
  volume_changed: { volume: number }
  zoom_changed: { zoom: number }
  tempo_changed: { bpm: number }
  metronome_toggled: { on: boolean }
  theme_changed: { theme: string }
  particle_changed: { style: string }
  instrument_changed: { from: string | undefined; to: string; method: 'cycle' | 'menu' }
  track_toggled: { enabled: boolean }
  synth_load_failed: { source: string }
  sample_load_failed: { sample_id: string; target: 'play' | 'learn' }
  export_degraded: { stage: 'audio_render'; output: string }
}

export type EventName = keyof EventMap
export type EventProps<K extends EventName> = EventMap[K]

export function trackEvent<K extends EventName>(name: K, props: EventProps<K>): void {
  track(name, props as Record<string, unknown>)
}

export function trackEventSettled<K extends EventName>(
  name: K,
  props: EventProps<K>,
  ms = 600,
): void {
  trackSettled(name, props as Record<string, unknown>, ms)
}
