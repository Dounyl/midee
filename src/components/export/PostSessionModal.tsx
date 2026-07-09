// Shown when live-mode session recording ends. Offers three clear next
// steps so users are not forced into an immediate download: they can
// visualize the take, save it as MIDI, or discard it.

import { createSignal } from 'solid-js'
import { Portal, render } from 'solid-js/web'
import { icons } from '@/components/common/icons'
import { cssModuleClass } from '@/components/common/utils'
import { t, tn } from '@/i18n'
import styles from './PostSessionModal.module.css'

export type SessionAction = 'open-in-file' | 'download' | 'discard'

interface ViewProps {
  container: HTMLElement
  isOpen: () => boolean
  stats: () => string
  onAction: (action: SessionAction) => void
}

function PostSessionView(props: ViewProps) {
  return (
    <Portal mount={props.container}>
      <div
        id="post-session-modal"
        class={styles.postSessionModal}
        classList={{ [styles.open!]: props.isOpen() }}
      >
        <button
          type="button"
          class={styles.postSessionBackdrop}
          aria-label={t('postSession.discard.title')}
          onClick={() => props.onAction('discard')}
        />
        <div class={cssModuleClass(styles, 'post-session-card', 'modal-scroll')}>
          <header class={styles['export-header']!}>
            <div class={styles['export-card-icon']!} innerHTML={icons.waveform()} />
            <div class={styles['export-header-text']!}>
              <h2 class={styles['export-card-title']!}>{t('postSession.title')}</h2>
              <p class={styles['export-card-sub']!}>{props.stats()}</p>
            </div>
          </header>

          <div class={styles['post-session-actions']!}>
            <button
              type="button"
              class={cssModuleClass(styles, 'post-session-option', 'post-session-option--primary')}
              onClick={() => props.onAction('open-in-file')}
            >
              <span class={styles['post-session-option-icon']!} innerHTML={icons.timeline()} />
              <span class={styles['post-session-option-body']!}>
                <span class={styles['post-session-option-title']!}>
                  {t('postSession.openInFile.title')}
                </span>
                <span class={styles['post-session-option-sub']!}>
                  {t('postSession.openInFile.sub')}
                </span>
              </span>
            </button>

            <button
              type="button"
              class={styles['post-session-option']!}
              onClick={() => props.onAction('download')}
            >
              <span class={styles['post-session-option-icon']!} innerHTML={icons.download(18)} />
              <span class={styles['post-session-option-body']!}>
                <span class={styles['post-session-option-title']!}>
                  {t('postSession.download.title')}
                </span>
                <span
                  class={styles['post-session-option-sub']!}
                  innerHTML={t('postSession.download.sub.html')}
                />
              </span>
            </button>

            <button
              type="button"
              class={cssModuleClass(styles, 'post-session-option', 'post-session-option--muted')}
              onClick={() => props.onAction('discard')}
            >
              <span class={styles['post-session-option-icon']!} innerHTML={icons.trash()} />
              <span class={styles['post-session-option-body']!}>
                <span class={styles['post-session-option-title']!}>
                  {t('postSession.discard.title')}
                </span>
                <span class={styles['post-session-option-sub']!}>
                  {t('postSession.discard.sub')}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

export class PostSessionModal {
  private disposeRoot: (() => void) | null = null
  private wrapper: HTMLDivElement | null = null
  private readonly setIsOpen: (v: boolean) => void
  private readonly readIsOpen: () => boolean
  private readonly setStats: (v: string) => void

  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    if (!this.readIsOpen()) return
    this.onAction?.('discard')
  }

  onAction?: (action: SessionAction) => void

  constructor(container: HTMLElement) {
    const [isOpen, setIsOpen] = createSignal(false)
    const [stats, setStats] = createSignal('...')

    this.setIsOpen = setIsOpen
    this.readIsOpen = isOpen
    this.setStats = setStats

    const wrapper = document.createElement('div')
    wrapper.style.display = 'contents'
    container.appendChild(wrapper)
    this.wrapper = wrapper

    this.disposeRoot = render(
      () => (
        <PostSessionView
          container={container}
          isOpen={isOpen}
          stats={stats}
          onAction={(a) => this.onAction?.(a)}
        />
      ),
      wrapper,
    )
    document.addEventListener('keydown', this.onKey)
  }

  open(durationSec: number, noteCount: number): void {
    this.setStats(
      tn('postSession.stats', noteCount, {
        duration: formatMMSS(durationSec),
      }),
    )
    this.setIsOpen(true)
  }

  close(): void {
    this.setIsOpen(false)
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKey)
    this.disposeRoot?.()
    this.disposeRoot = null
    this.wrapper?.remove()
    this.wrapper = null
  }
}

function formatMMSS(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m.toString().padStart(1, '0')}:${sec.toString().padStart(2, '0')}`
}
