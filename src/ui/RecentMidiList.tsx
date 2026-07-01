import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import {
  listLocalMidiEntries,
  loadSamplePlaybackHistory,
  MIDI_LIBRARY_CHANGED,
} from '../core/midiLibrary'
import { SAMPLES } from '../core/samples'
import { t } from '../i18n'
import type { LibraryOpenRequest } from '../store/AppCtx'
import { icons } from './icons'
import './RecentMidiList.css'

interface RecentMidiEntry {
  kind: 'local' | 'sample'
  id: string
  name: string
  sub: string
  playedAt: number
  matchName: string
}

export interface RecentMidiListProps {
  title: string
  target: 'play' | 'learn'
  currentName?: string | null
  emptyLabel?: string
  class?: string
  variant?: 'floating' | 'inline'
  onOpen: (request: LibraryOpenRequest) => void | Promise<void>
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function RecentMidiList(props: RecentMidiListProps) {
  const inline = (): boolean => props.variant === 'inline'
  const toggleEmoji = (): string => (props.target === 'learn' ? '🎼' : '🎵')
  const primaryLabel = (): string =>
    props.target === 'learn' ? t('midiLibrary.practice') : t('midiLibrary.play')
  const primaryIcon = (): string =>
    props.target === 'learn' ? icons.practice(10) : icons.play(10)
  const [entries, setEntries] = createSignal<RecentMidiEntry[]>([])
  const [open, setOpen] = createSignal(inline())
  const [launching, setLaunching] = createSignal(false)
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let launchTimer: ReturnType<typeof setTimeout> | null = null

  const panelOpen = (): boolean => (inline() ? true : open())

  const clearHideTimer = (): void => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
  }

  const pulseLaunch = (): void => {
    if (launchTimer) clearTimeout(launchTimer)
    setLaunching(true)
    launchTimer = setTimeout(() => {
      setLaunching(false)
      launchTimer = null
    }, 520)
  }

  const armAutoHide = (): void => {
    if (inline()) return
    clearHideTimer()
    hideTimer = setTimeout(() => {
      setOpen(false)
      hideTimer = null
    }, 3000)
  }

  const refresh = async (): Promise<void> => {
    try {
      const sampleHistory = loadSamplePlaybackHistory()
      const localEntries = await listLocalMidiEntries(6)
      const sampleEntries: RecentMidiEntry[] = SAMPLES.map((sample, index) => ({
        kind: 'sample',
        id: sample.id,
        name: sample.title,
        sub: sample.composer,
        playedAt: sampleHistory[sample.id] ?? -(index + 1),
        matchName: sample.displayName,
      }))
      const localMapped: RecentMidiEntry[] = localEntries.map((entry) => ({
        kind: 'local',
        id: entry.id,
        name: entry.name,
        sub: `${formatDuration(entry.duration)} - ${t('midiLibrary.metaNotes', { count: entry.noteCount })}`,
        playedAt: entry.lastPlayedAt,
        matchName: entry.name,
      }))
      const next = [...localMapped, ...sampleEntries]
        .sort((a, b) => b.playedAt - a.playedAt)
        .slice(0, 6)
      setEntries(next)
      if (inline()) {
        setOpen(true)
      } else if (next.length > 0) {
        setOpen(true)
        armAutoHide()
      } else {
        setOpen(false)
      }
    } catch (err) {
      console.warn('[RecentMidiList] refresh failed', err)
      setEntries([])
      setOpen(inline())
    }
  }

  onMount(() => {
    void refresh()
    const onChanged = (): void => {
      void refresh()
    }
    window.addEventListener(MIDI_LIBRARY_CHANGED, onChanged)
    onCleanup(() => {
      window.removeEventListener(MIDI_LIBRARY_CHANGED, onChanged)
      clearHideTimer()
      if (launchTimer) clearTimeout(launchTimer)
    })
  })

  const openEntry = (entry: RecentMidiEntry, target: 'play' | 'learn'): void => {
    clearHideTimer()
    if (!inline()) setOpen(false)
    void props.onOpen({
      kind: 'recent',
      target,
      entry: { kind: entry.kind, id: entry.id },
    })
  }

  return (
    <section
      class={`recent-midi-fab ${inline() ? 'recent-midi-fab--inline' : ''} ${props.class ?? ''}`}
    >
      <Show when={!inline()}>
        <button
          type="button"
          class="recent-midi-fab__toggle"
          classList={{ launching: launching() }}
          onClick={() => {
            const next = !open()
            pulseLaunch()
            setOpen(next)
            if (next) armAutoHide()
            else clearHideTimer()
          }}
          aria-expanded={panelOpen() ? 'true' : 'false'}
          aria-label={props.title}
          title={props.title}
        >
          <span class="recent-midi-fab__emoji" aria-hidden="true">
            {toggleEmoji()}
          </span>
        </button>
      </Show>

      <div
        class="recent-midi-fab__panel"
        classList={{ open: panelOpen(), launching: launching() && !inline() }}
      >
        <div class="recent-midi-fab__panel-head">
          <div class="recent-midi-fab__copy">
            <span class="recent-midi-fab__eyebrow">
              {props.target === 'learn' ? t('midiLibrary.practice') : t('midiLibrary.play')}
            </span>
            <span class="recent-midi-fab__title">{props.title}</span>
          </div>
          <Show when={!inline()}>
            <span
              class="recent-midi-fab__chevron"
              classList={{ open: panelOpen() }}
              innerHTML={icons.chevronDown(11)}
            />
          </Show>
        </div>

        <Show
          when={entries().length > 0}
          fallback={
            <div class="recent-midi-fab__empty">{props.emptyLabel ?? t('midiLibrary.empty')}</div>
          }
        >
          <div class="recent-midi-fab__list">
            <For each={entries()}>
              {(entry) => (
                <button
                  type="button"
                  class="recent-midi-fab__item"
                  classList={{ 'is-active': props.currentName === entry.matchName }}
                  onClick={() => openEntry(entry, props.target)}
                >
                  <span class="recent-midi-fab__item-icon" innerHTML={primaryIcon()} />
                  <span class="recent-midi-fab__item-copy">
                    <span class="recent-midi-fab__item-title">{entry.name}</span>
                    <span class="recent-midi-fab__item-sub">{entry.sub}</span>
                  </span>
                  <span
                    class="recent-midi-fab__item-cta"
                    classList={{ 'recent-midi-fab__item-cta--play': props.target === 'play' }}
                  >
                    <span innerHTML={primaryIcon()} />
                    <span>{primaryLabel()}</span>
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </section>
  )
}
