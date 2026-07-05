import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { LibraryOpenRequest } from '@/stores/app/AppCtx'
import {
  listLocalMidiEntries,
  loadSamplePlaybackHistory,
  MIDI_LIBRARY_CHANGED,
} from '../core/midiLibrary'
import { SAMPLES } from '../core/samples'
import { t } from '../i18n'
import { icons } from './icons'
import styles from './RecentMidiList.module.css'

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
  eyebrow?: string | null
  currentName?: string | null
  emptyLabel?: string
  class?: string
  variant?: 'floating' | 'inline'
  tone?: 'default' | 'play-empty' | 'learn-page' | 'learn-library'
  defaultOpen?: boolean
  onOpen: (request: LibraryOpenRequest) => void | Promise<void>
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function buildSampleEntries(): RecentMidiEntry[] {
  const sampleHistory = loadSamplePlaybackHistory()
  return SAMPLES.map((sample, index) => ({
    kind: 'sample' as const,
    id: sample.id,
    name: sample.title,
    sub: sample.composer,
    playedAt: sampleHistory[sample.id] ?? -(index + 1),
    matchName: sample.displayName,
  })).sort((a, b) => b.playedAt - a.playedAt)
}

export function RecentMidiList(props: RecentMidiListProps) {
  const inline = (): boolean => props.variant === 'inline'
  const toggleEmoji = (): string => (props.target === 'learn' ? '🎼' : '🎵')
  const primaryLabel = (): string =>
    props.target === 'learn' ? t('midiLibrary.practice') : t('midiLibrary.play')
  const primaryIcon = (): string => (props.target === 'learn' ? icons.practice(10) : icons.play(10))
  const [entries, setEntries] = createSignal<RecentMidiEntry[]>([])
  const [open, setOpen] = createSignal(inline() || Boolean(props.defaultOpen))
  const [launching, setLaunching] = createSignal(false)
  let launchTimer: ReturnType<typeof setTimeout> | null = null
  let initialized = false
  let rootEl: HTMLElement | undefined

  const playEmptyToneClass = styles.tonePlayEmpty ?? ''
  const learnPageToneClass = styles.toneLearnPage ?? ''
  const learnLibraryToneClass = styles.toneLearnLibrary ?? ''
  const launchingClass = styles.launching ?? ''
  const openClass = styles.open ?? ''
  const activeClass = styles.isActive ?? ''
  const panelOpen = (): boolean => (inline() ? true : open())
  const rootClass = (): string =>
    [
      styles.recentMidiFab,
      inline() ? styles.recentMidiFabInline : '',
      props.tone === 'play-empty' ? playEmptyToneClass : '',
      props.tone === 'learn-page' ? learnPageToneClass : '',
      props.tone === 'learn-library' ? learnLibraryToneClass : '',
      props.class ?? '',
    ]
      .filter(Boolean)
      .join(' ')
  const toggleClass = (): string =>
    [styles.recentMidiFabToggle, launching() ? launchingClass : ''].filter(Boolean).join(' ')
  const panelClass = (): string =>
    [
      styles.recentMidiFabPanel,
      panelOpen() ? openClass : '',
      launching() && !inline() ? launchingClass : '',
    ]
      .filter(Boolean)
      .join(' ')
  const chevronClass = (): string =>
    [styles.recentMidiFabChevron, panelOpen() ? openClass : ''].filter(Boolean).join(' ')
  const itemClass = (isActive: boolean): string =>
    [styles.recentMidiFabItem, isActive ? activeClass : ''].filter(Boolean).join(' ')
  const ctaClass = (isPlay: boolean): string =>
    [styles.recentMidiFabItemCta, isPlay ? styles.recentMidiFabItemCtaPlay : '']
      .filter(Boolean)
      .join(' ')
  const listViewportClass = (): string =>
    [styles.recentMidiFabListViewport, 'scroll-viewport'].filter(Boolean).join(' ')

  const pulseLaunch = (): void => {
    if (launchTimer) clearTimeout(launchTimer)
    setLaunching(true)
    launchTimer = setTimeout(() => {
      setLaunching(false)
      launchTimer = null
    }, 520)
  }

  const refresh = async (): Promise<void> => {
    let next = buildSampleEntries()
    try {
      const localEntries = await listLocalMidiEntries(20)
      const localMapped: RecentMidiEntry[] = localEntries.map((entry) => ({
        kind: 'local',
        id: entry.id,
        name: entry.name,
        sub: `${formatDuration(entry.duration)} - ${t('midiLibrary.metaNotes', { count: entry.noteCount })}`,
        playedAt: entry.lastPlayedAt,
        matchName: entry.name,
      }))
      next = [...localMapped, ...next].sort((a, b) => b.playedAt - a.playedAt)
    } catch (err) {
      console.warn('[RecentMidiList] refresh failed', err)
    }
    setEntries(next)
    if (inline()) {
      setOpen(true)
    } else if (next.length === 0) {
      setOpen(false)
    } else if (!initialized) {
      setOpen(Boolean(props.defaultOpen))
    }
    initialized = true
  }

  onMount(() => {
    void refresh()
    const onChanged = (): void => {
      void refresh()
    }
    const onDocumentPointerDown = (event: PointerEvent): void => {
      if (inline() || !open()) return
      const target = event.target as Node | null
      if (target && rootEl?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener(MIDI_LIBRARY_CHANGED, onChanged)
    document.addEventListener('pointerdown', onDocumentPointerDown)
    onCleanup(() => {
      window.removeEventListener(MIDI_LIBRARY_CHANGED, onChanged)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      if (launchTimer) clearTimeout(launchTimer)
    })
  })

  const openEntry = (entry: RecentMidiEntry, target: 'play' | 'learn'): void => {
    if (!inline()) setOpen(false)
    void props.onOpen({
      kind: 'recent',
      target,
      entry: { kind: entry.kind, id: entry.id },
    })
  }

  return (
    <section ref={rootEl} class={rootClass()}>
      <Show when={!inline()}>
        <button
          type="button"
          class={toggleClass()}
          onClick={() => {
            pulseLaunch()
            setOpen(!open())
          }}
          aria-expanded={panelOpen() ? 'true' : 'false'}
          aria-label={props.title}
          title={props.title}
        >
          <span class={styles.recentMidiFabEmoji} aria-hidden="true">
            {toggleEmoji()}
          </span>
        </button>
      </Show>

      <div class={panelClass()}>
        <div class={styles.recentMidiFabPanelHead}>
          <div class={styles.recentMidiFabCopy}>
            <Show when={props.eyebrow !== null}>
              <span class={styles.recentMidiFabEyebrow}>
                {props.eyebrow ??
                  (props.target === 'learn' ? t('midiLibrary.practice') : t('midiLibrary.play'))}
              </span>
            </Show>
            <span class={styles.recentMidiFabTitle}>{props.title}</span>
          </div>
          <Show when={!inline()}>
            <span class={chevronClass()} innerHTML={icons.chevronDown(11)} />
          </Show>
        </div>

        <Show
          when={entries().length > 0}
          fallback={
            <div class={styles.recentMidiFabEmpty}>
              {props.emptyLabel ?? t('midiLibrary.empty')}
            </div>
          }
        >
          <div class={listViewportClass()}>
            <div class={styles.recentMidiFabList}>
              <For each={entries()}>
                {(entry) => (
                  <button
                    type="button"
                    class={itemClass(props.currentName === entry.matchName)}
                    onClick={() => openEntry(entry, props.target)}
                  >
                    <span class={styles.recentMidiFabItemIcon} innerHTML={primaryIcon()} />
                    <span class={styles.recentMidiFabItemCopy}>
                      <span class={styles.recentMidiFabItemTitle}>{entry.name}</span>
                      <span class={styles.recentMidiFabItemSub}>{entry.sub}</span>
                    </span>
                    <span class={ctaClass(props.target === 'play')}>
                      <span innerHTML={primaryIcon()} />
                      <span>{primaryLabel()}</span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </section>
  )
}
