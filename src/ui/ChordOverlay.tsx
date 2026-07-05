import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import type { ChordReading } from '../core/music/ChordDetector'
import { t } from '../i18n'
import styles from './ChordOverlay.module.css'

// Inline chord readout — lives in the top strip rather than as a floating
// card, so it sits as a quiet supplementary cue beside the now-playing
// status pill instead of grabbing focus from the canvas. Toggled visible
// via the topbar Chord button.

interface ViewProps {
  visible: () => boolean
  tonic: () => string
  qualityHtml: () => string
  empty: () => boolean
  registerEl: (el: HTMLElement) => void
}

function ChordReadoutView(props: ViewProps) {
  const readoutClass = () =>
    [
      styles.tsChordReadout,
      props.visible() ? styles.tsChordReadoutOn : '',
      props.empty() ? styles.tsChordReadoutEmpty : '',
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <span
      ref={(el) => props.registerEl(el)}
      id="ts-chord-readout"
      class={readoutClass()}
      role="status"
      aria-live="polite"
      aria-label={t('chord.aria')}
    >
      <span class={styles.tsChordReadoutName}>
        <span class={styles.tsChordReadoutTonic}>{props.tonic()}</span>
        <Show when={props.qualityHtml()} fallback={<span class={styles.tsChordReadoutQuality} />}>
          <span class={styles.tsChordReadoutQuality} innerHTML={props.qualityHtml()} />
        </Show>
      </span>
    </span>
  )
}

export class ChordOverlay {
  private rootEl!: HTMLElement
  private disposeRoot: (() => void) | null = null
  private wrapper: HTMLDivElement | null = null
  private visible = false
  private lastSignature = ''
  // Hold-over timer so a momentary gap (legato release between chords)
  // doesn't collapse the readout to "—" for a single frame and flash.
  private clearTimer: ReturnType<typeof setTimeout> | null = null

  private readonly setVisibleSig: (v: boolean) => void
  private readonly setTonic: (v: string) => void
  private readonly setQualityHtml: (v: string) => void
  private readonly setEmpty: (v: boolean) => void

  constructor(slot: HTMLElement) {
    const [visible, setVisible] = createSignal(false)
    const [tonic, setTonic] = createSignal('—')
    const [qualityHtml, setQualityHtml] = createSignal('')
    const [empty, setEmpty] = createSignal(true)

    this.setVisibleSig = setVisible
    this.setTonic = setTonic
    this.setQualityHtml = setQualityHtml
    this.setEmpty = setEmpty

    const wrapper = document.createElement('div')
    wrapper.style.display = 'contents'
    slot.appendChild(wrapper)
    this.wrapper = wrapper

    this.disposeRoot = render(
      () => (
        <ChordReadoutView
          visible={visible}
          tonic={tonic}
          qualityHtml={qualityHtml}
          empty={empty}
          registerEl={(el) => {
            this.rootEl = el
          }}
        />
      ),
      wrapper,
    )
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.setVisibleSig(visible)
    if (!visible) {
      this.lastSignature = ''
      this.cancelClearTimer()
    }
  }

  get isVisible(): boolean {
    return this.visible
  }

  // Push a new reading. No-op when hidden — saves DOM thrash on every frame
  // when the user has the readout turned off.
  update(reading: ChordReading): void {
    if (!this.visible) return

    const sig = reading.name ?? reading.pitchClasses.join('·')
    if (sig === this.lastSignature) return

    // Empty reading: defer the visual reset by ~140ms so brief silences
    // between chord changes don't blink the readout.
    if (sig === '') {
      if (this.clearTimer) return
      this.clearTimer = setTimeout(() => {
        this.applyReading(EMPTY_READING)
        this.lastSignature = ''
        this.clearTimer = null
      }, 140)
      return
    }

    this.cancelClearTimer()
    this.applyReading(reading)
    this.lastSignature = sig
  }

  private applyReading(r: ChordReading): void {
    const isEmpty = !r.name && r.pitchClasses.length === 0
    const pulseClass = styles.tsChordReadoutPulse ?? 'ts-chord-readout--pulse'
    this.setEmpty(isEmpty)
    // Force-restart the entry animation so each chord change reads as a small
    // beat. Toggle the class off first, then re-add after a forced reflow.
    this.rootEl.classList.remove(pulseClass)
    void this.rootEl.offsetWidth
    this.rootEl.classList.add(pulseClass)

    if (isEmpty) {
      this.setTonic('—')
      this.setQualityHtml('')
      return
    }

    if (r.name) {
      this.setTonic(formatTonic(r.tonic ?? r.name))
      this.setQualityHtml(formatQualityHtml(r.quality ?? ''))
      return
    }

    // No chord matched — show the pitch classes joined as a fallback.
    this.setTonic(r.pitchClasses.map(formatTonic).join('·'))
    this.setQualityHtml('')
  }

  private cancelClearTimer(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer)
      this.clearTimer = null
    }
  }

  dispose(): void {
    this.cancelClearTimer()
    this.disposeRoot?.()
    this.disposeRoot = null
    this.wrapper?.remove()
    this.wrapper = null
  }

  // Used by Controls to reach into the DOM for layout measuring — kept for
  // parity with the pre-port class.
  get root(): HTMLElement {
    return this.rootEl
  }
}

const EMPTY_READING: ChordReading = {
  name: null,
  tonic: null,
  quality: null,
  pitchClasses: [],
}

// Replace ASCII accidentals with proper musical glyphs so the readout looks
// typographically right ("F♯" not "F#").
function formatTonic(s: string): string {
  return s.replace(/#/g, '♯').replace(/b/g, '♭')
}

// The quality string carries minor sevenths, sus4s, slash bass, etc. Render
// the "/Bass" portion in a softer color so inversions read at a glance.
function formatQualityHtml(quality: string): string {
  if (!quality) return ''
  const slashIdx = quality.indexOf('/')
  if (slashIdx < 0) return escapeHtml(formatTonic(quality))
  const head = quality.slice(0, slashIdx)
  const tail = quality.slice(slashIdx + 1)
  return `${escapeHtml(formatTonic(head))}<span class="${styles.tsChordReadoutBass}">/${escapeHtml(formatTonic(tail))}</span>`
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c,
  )
}
