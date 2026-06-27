import { createEffect, createMemo, createSignal, For } from 'solid-js'
import { render } from 'solid-js/web'
import { t } from '../i18n'
import type { MidiKeySignature } from '../core/midi/types'
import {
  buildTransposeOptions,
  keySignatureLabel,
  transposeKeySignature,
} from '../core/music/KeySignature'
import { icons } from './icons'
import { isNarrowViewport } from './utils'

interface PanelProps {
  isOpen: () => boolean
  isSheet: () => boolean
  enabled: () => boolean
  baseKey: () => MidiKeySignature | null
  current: () => number
  registerTriggerEl: (el: HTMLButtonElement) => void
  onToggle: () => void
  onChange: (value: number) => void
  onResetToC: () => void
  registerPanelEl: (el: HTMLElement) => void
}

function ConsolePanelView(props: PanelProps) {
  let selectEl: HTMLSelectElement | undefined
  const options = createMemo(() => buildTransposeOptions(props.baseKey(), props.current()))
  const currentKeyLabel = () => keySignatureLabel(transposeKeySignature(props.baseKey(), props.current()))

  createEffect(() => {
    const value = String(props.current())
    queueMicrotask(() => {
      if (selectEl && selectEl.value !== value) selectEl.value = value
    })
  })

  return (
    <div class="console-dock">
      <button
        ref={(el) => props.registerTriggerEl(el)}
        class="console-trigger"
        classList={{ 'console-trigger--open': props.isOpen() }}
        type="button"
        aria-label={t('topStrip.console')}
        data-tip={t('topStrip.console')}
        onClick={() => props.onToggle()}
      >
        <span class="console-trigger-icon" aria-hidden="true" innerHTML={icons.chord(14)} />
        <span class="console-trigger-chev" aria-hidden="true" innerHTML={icons.chevronDown(11)} />
        <span class="sr-visually-hidden">{t('topStrip.console')}</span>
      </button>
      <div
        id="console-panel"
        class="console-panel"
        classList={{
          'console-panel--open': props.isOpen(),
          'popover--sheet': props.isSheet(),
        }}
        ref={(el) => props.registerPanelEl(el)}
      >
        <div class="panel-header">
          <span class="panel-label">{t('console.transpose')}</span>
        </div>
        <div class="console-body">
          <div class="console-row">
            <span class="console-label">{t('console.transpose')}</span>
            <span class="console-value">{currentKeyLabel()}</span>
          </div>
          <div class="console-row console-row--transpose">
            <select
              ref={(el) => {
                selectEl = el
              }}
              class="console-select"
              value={String(props.current())}
              disabled={!props.enabled()}
              aria-label={t('hud.aria.transpose')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onInput={(e) => props.onChange(parseInt(e.currentTarget.value, 10))}
              onChange={(e) => props.onChange(parseInt(e.currentTarget.value, 10))}
            >
              <For each={options()}>
                {(opt) => <option value={String(opt.value)}>{opt.label}</option>}
              </For>
            </select>
            <button
              class="console-reset"
              type="button"
              disabled={!props.enabled()}
              aria-label={t('hud.aria.transposeReset')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                props.onResetToC()
              }}
            >
              C
            </button>
          </div>
          <div class="console-sub">
            {props.enabled() ? t('console.transpose.enabled') : t('console.transpose.disabled')}
          </div>
        </div>
      </div>
    </div>
  )
}

export class ConsolePanel {
  private disposeRoot: (() => void) | null = null
  private wrapper: HTMLDivElement | null = null
  private panelEl: HTMLElement | null = null
  private trigger: HTMLElement | null = null

  private readonly setIsOpen: (v: boolean) => void
  private readonly isOpenFn: () => boolean
  private readonly setIsSheet: (v: boolean) => void
  private readonly setEnabled: (v: boolean) => void
  private readonly setBaseKey: (v: MidiKeySignature | null) => void
  private readonly setCurrent: (v: number) => void

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpenFn()) this.close()
  }
  private onResize = (): void => {
    if (!this.isOpenFn()) return
    if (isNarrowViewport()) this.setIsSheet(true)
    else this.setIsSheet(false)
  }

  constructor(
    container: HTMLElement,
    onChange: (value: number) => void,
    onResetToC: () => void,
  ) {
    const [isOpen, setIsOpen] = createSignal(false)
    const [isSheet, setIsSheet] = createSignal(false)
    const [enabled, setEnabled] = createSignal(false)
    const [baseKey, setBaseKey] = createSignal<MidiKeySignature | null>(null)
    const [current, setCurrent] = createSignal(0)

    this.isOpenFn = isOpen
    this.setIsOpen = setIsOpen
    this.setIsSheet = setIsSheet
    this.setEnabled = setEnabled
    this.setBaseKey = setBaseKey
    this.setCurrent = setCurrent

    const wrapper = document.createElement('div')
    container.appendChild(wrapper)
    this.wrapper = wrapper
    this.disposeRoot = render(
      () => (
        <ConsolePanelView
          isOpen={isOpen}
          isSheet={isSheet}
          enabled={enabled}
          baseKey={baseKey}
          current={current}
          registerTriggerEl={(el) => {
            this.trigger = el
          }}
          onToggle={() => this.toggle()}
          onChange={onChange}
          onResetToC={onResetToC}
          registerPanelEl={(el) => {
            this.panelEl = el
          }}
        />
      ),
      wrapper,
    )
  }

  updateState(enabled: boolean, baseKey: MidiKeySignature | null, current: number): void {
    this.setEnabled(enabled)
    this.setBaseKey(baseKey)
    this.setCurrent(current)
  }

  toggle(): void {
    if (this.isOpenFn()) this.close()
    else this.open()
  }

  close(): void {
    if (!this.isOpenFn()) return
    this.setIsOpen(false)
    this.setIsSheet(false)
    document.removeEventListener('keydown', this.onKey)
    window.removeEventListener('resize', this.onResize)
  }

  dispose(): void {
    this.close()
    this.disposeRoot?.()
    this.disposeRoot = null
    this.wrapper?.remove()
    this.wrapper = null
  }

  private open(): void {
    if (this.isOpenFn()) return
    this.setIsOpen(true)
    this.setIsSheet(isNarrowViewport())
    setTimeout(() => {
      document.addEventListener('keydown', this.onKey)
      window.addEventListener('resize', this.onResize)
    }, 0)
  }
}
