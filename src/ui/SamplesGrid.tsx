import { createSignal, For, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { computeSparkline, fetchSampleMidi, SAMPLES, type Sample } from '../core/samples'
import { t } from '../i18n'
import { icons } from './icons'

// Row of sample cards. Each card shows a pitch-density sparkline pulled from
// the parsed MIDI — so the bars follow the actual shape of the piece rather
// than a placeholder. Bars have a gradient fill, rounded tops, accent bloom,
// and a staggered lift on hover.

const BARS = 32

interface SampleState {
  bars: readonly number[]
  sub: string
}

interface CardProps {
  sample: Sample
  state: () => SampleState
  onSelect: (id: string) => void
  onPractice?: (id: string) => void
}

function SampleCardView(props: CardProps) {
  return (
    <article
      class="sample-card"
      data-sample-id={props.sample.id}
      style={{ '--sample-accent': props.sample.accent }}
    >
      <button class="sample-card-main" type="button" onClick={() => props.onSelect(props.sample.id)}>
        <div class="sample-card-viz" aria-hidden="true">
          <div class="sample-card-bars">
            <For each={props.state().bars}>
              {(h, i) => (
                <span
                  style={{
                    '--h': `${Math.max(14, Math.round(h * 100))}%`,
                    '--d': `${i() * 18}ms`,
                  }}
                />
              )}
            </For>
          </div>
        </div>
        <div class="sample-card-meta">
          <div class="sample-card-title">{props.sample.title}</div>
          <div class="sample-card-sub">{props.state().sub}</div>
        </div>
      </button>
      <div class="sample-card-actions">
        <button
          class="sample-card-action sample-card-action--play"
          type="button"
          onClick={() => props.onSelect(props.sample.id)}
        >
          <span innerHTML={icons.play(11)} />
          <span>{t('midiLibrary.play')}</span>
        </button>
        <button
          class="sample-card-action"
          type="button"
          onClick={() => (props.onPractice ?? props.onSelect)(props.sample.id)}
        >
          <span innerHTML={icons.practice(11)} />
          <span>{t('midiLibrary.practice')}</span>
        </button>
      </div>
    </article>
  )
}

function placeholderBars(): readonly number[] {
  return Array.from({ length: BARS }, (_, i) => 0.28 + 0.22 * Math.sin((i / BARS) * Math.PI * 3))
}

interface GridProps {
  onSelect: (sampleId: string) => void
  onPractice?: (sampleId: string) => void
}

function SamplesGridView(props: GridProps) {
  // Each sample gets its own signal so hydration updates don't re-render
  // siblings. Placeholder bars (soft sine) until real MIDI lands.
  const states = SAMPLES.map((sample) => {
    const [state, setState] = createSignal<SampleState>({
      bars: placeholderBars(),
      sub: `${sample.composer} · —`,
    })
    return { sample, state, setState }
  })

  onMount(() => {
    void hydrateAll(states)
  })

  return (
    <div class="samples-grid">
      <For each={states}>
        {(entry) => {
          const cardProps: CardProps = {
            sample: entry.sample,
            state: entry.state,
            onSelect: props.onSelect,
            ...(props.onPractice ? { onPractice: props.onPractice } : {}),
          }
          return <SampleCardView {...cardProps} />
        }}
      </For>
    </div>
  )
}

async function hydrateAll(
  entries: Array<{
    sample: Sample
    setState: (v: SampleState) => void
  }>,
): Promise<void> {
  for (const { sample, setState } of entries) {
    try {
      const midi = await fetchSampleMidi(sample)
      const bars = computeSparkline(midi, BARS)
      setState({
        bars,
        sub: `${sample.composer} · ${formatDuration(midi.duration)}`,
      })
    } catch (err) {
      console.warn(`[SamplesGrid] hydrate failed for ${sample.id}`, err)
    }
  }
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export class SamplesGrid {
  private el: HTMLElement
  private disposeRoot: (() => void) | null = null
  onSelect?: (sampleId: string) => void
  onPractice?: (sampleId: string) => void

  constructor() {
    this.el = document.createElement('div')
    this.el.style.display = 'contents'
    this.disposeRoot = render(
      () => (
        <SamplesGridView
          onSelect={(id) => this.onSelect?.(id)}
          onPractice={(id) => this.onPractice?.(id)}
        />
      ),
      this.el,
    )
  }

  get root(): HTMLElement {
    return this.el
  }

  dispose(): void {
    this.disposeRoot?.()
    this.disposeRoot = null
    this.el.remove()
  }
}
