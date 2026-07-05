import { createSignal } from 'solid-js'
import { Portal, render } from 'solid-js/web'
import { t } from '../i18n'
import { icons } from './icons'
import styles from './KeyboardModeSuggestionModal.module.css'

interface TransposeOption {
  semitones: number
  label: string
}

interface OpenOpts {
  options: readonly TransposeOption[]
  onTranspose: (semitones: number) => void
  onSwitchTo88: () => void
  onClose?: () => void
}

interface ViewProps {
  container: HTMLElement
  isOpen: () => boolean
  options: () => readonly TransposeOption[]
  onTranspose: (semitones: number) => void
  onSwitchTo88: () => void
  onClose: () => void
}

function KeyboardModeSuggestionView(props: ViewProps) {
  const hasOptions = () => props.options().length > 0
  return (
    <Portal mount={props.container}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses the modal */}
      <div
        id="keyboard-mode-modal"
        role="presentation"
        class={`${styles.keyboardModeModal} ${props.isOpen() ? styles.open : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && props.isOpen()) props.onClose()
        }}
      >
        <div
          class={`${styles.keyboardModeCard} modal-scroll`}
          role="dialog"
          aria-label={t('keyboardModeSuggestion.title')}
          aria-hidden={!props.isOpen()}
        >
          <div class="panel-header">
            <span class="panel-label">{t('keyboardModeSuggestion.title')}</span>
            <button
              type="button"
              class={styles.keyboardModeClose}
              aria-label={t('midiPicker.close')}
              onClick={() => props.onClose()}
              innerHTML={icons.close(14)}
            />
          </div>
          <div class={styles.consoleBody}>
            <div class={`${styles.consoleSub} ${styles.keyboardModeCopy}`}>
              {hasOptions()
                ? t('keyboardModeSuggestion.body')
                : t('keyboardModeSuggestion.bodyNoOptions')}
            </div>
            {hasOptions() ? (
              <div class={styles.keyboardModeOptions}>
                {props.options().map((opt) => (
                  <button
                    type="button"
                    class={`${styles.consoleSegment} ${styles.keyboardModeOption}`}
                    onClick={() => props.onTranspose(opt.semitones)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div class={styles.keyboardModeActions}>
              <button
                type="button"
                class={`${styles.modalBtn} ${styles.modalBtnAccent}`}
                onClick={() => props.onSwitchTo88()}
              >
                {t('keyboardModeSuggestion.switch88')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

export class KeyboardModeSuggestionModal {
  private disposeRoot: (() => void) | null = null
  private wrapper: HTMLDivElement | null = null
  private readonly setIsOpen: (v: boolean) => void
  private readonly readIsOpen: () => boolean
  private readonly setOptions: (v: readonly TransposeOption[]) => void
  private currentOpts: OpenOpts | null = null

  constructor(container: HTMLElement) {
    const [isOpen, setIsOpen] = createSignal(false)
    const [options, setOptions] = createSignal<readonly TransposeOption[]>([])
    this.setIsOpen = setIsOpen
    this.readIsOpen = isOpen
    this.setOptions = setOptions

    const wrapper = document.createElement('div')
    wrapper.style.display = 'contents'
    container.appendChild(wrapper)
    this.wrapper = wrapper

    this.disposeRoot = render(
      () => (
        <KeyboardModeSuggestionView
          container={container}
          isOpen={isOpen}
          options={options}
          onTranspose={(semitones) => this.handleTranspose(semitones)}
          onSwitchTo88={() => this.handleSwitchTo88()}
          onClose={() => this.close()}
        />
      ),
      wrapper,
    )
  }

  open(opts: OpenOpts): void {
    this.currentOpts = opts
    this.setOptions(opts.options)
    this.setIsOpen(true)
  }

  close(): void {
    if (!this.readIsOpen()) return
    this.setIsOpen(false)
    this.setOptions([])
    const cb = this.currentOpts?.onClose
    this.currentOpts = null
    cb?.()
  }

  dispose(): void {
    this.disposeRoot?.()
    this.disposeRoot = null
    this.wrapper?.remove()
    this.wrapper = null
  }

  private handleTranspose(semitones: number): void {
    const opts = this.currentOpts
    if (!opts) return
    this.close()
    opts.onTranspose(semitones)
  }

  private handleSwitchTo88(): void {
    const opts = this.currentOpts
    if (!opts) return
    this.close()
    opts.onSwitchTo88()
  }
}
