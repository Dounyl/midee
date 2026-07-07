import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { render } from 'solid-js/web'
import styles from './DropZone.module.css'

export type LoadSource = 'drag' | 'picker'
type DropHandler = (file: File, source: LoadSource) => void

function isMidiFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.mid') || lower.endsWith('.midi')
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

interface DropZoneProps {
  onDrop: DropHandler
  hidden: () => boolean
  triggerFilePicker: (fn: () => void) => void
}

function DropZoneView(props: DropZoneProps) {
  let inputEl!: HTMLInputElement
  const [dragOver, setDragOver] = createSignal(false)
  let dragDepth = 0

  const docDragEnter = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    dragDepth++
    setDragOver(true)
  }

  const docDragLeave = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) setDragOver(false)
  }

  const docDragOver = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
  }

  const docDrop = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth = 0
    setDragOver(false)
    const file = e.dataTransfer?.files[0]
    if (file && isMidiFile(file.name)) props.onDrop(file, 'drag')
  }

  onMount(() => {
    document.addEventListener('dragenter', docDragEnter)
    document.addEventListener('dragleave', docDragLeave)
    document.addEventListener('dragover', docDragOver)
    document.addEventListener('drop', docDrop)
    props.triggerFilePicker(() => inputEl.click())
  })

  onCleanup(() => {
    document.removeEventListener('dragenter', docDragEnter)
    document.removeEventListener('dragleave', docDragLeave)
    document.removeEventListener('dragover', docDragOver)
    document.removeEventListener('drop', docDrop)
  })

  return (
    <>
      <Show when={!props.hidden() && dragOver()}>
        <div class={styles.dropzone}>
          <div class={styles.dropzoneBackdrop}>
            <div class={styles.dropzonePrompt}>Drop a MIDI file to open it</div>
          </div>
        </div>
      </Show>
      <input
        type="file"
        id="midi-input"
        ref={inputEl}
        accept=".mid,.midi"
        style={{ display: 'none' }}
        onChange={() => {
          const file = inputEl.files?.[0]
          if (file && isMidiFile(file.name)) props.onDrop(file, 'picker')
          inputEl.value = ''
        }}
      />
    </>
  )
}

export class DropZone {
  private disposeRoot: (() => void) | null = null
  private wrapper: HTMLDivElement | null = null
  private hiddenSetter!: (v: boolean) => void
  private filePicker: (() => void) | null = null

  constructor(container: HTMLElement, onDrop: DropHandler, initialHidden = false) {
    const [hidden, setHidden] = createSignal(initialHidden)
    this.hiddenSetter = setHidden

    const wrapper = document.createElement('div')
    container.appendChild(wrapper)
    this.wrapper = wrapper
    this.disposeRoot = render(
      () => (
        <DropZoneView
          onDrop={onDrop}
          hidden={hidden}
          triggerFilePicker={(fn) => {
            this.filePicker = fn
          }}
        />
      ),
      wrapper,
    )
  }

  updateMidiStatus(_status: unknown, _deviceName: string): void {}

  openFilePicker(): void {
    this.filePicker?.()
  }

  show(): void {
    this.hiddenSetter(false)
  }

  hide(): void {
    this.hiddenSetter(true)
  }

  dispose(): void {
    this.disposeRoot?.()
    this.disposeRoot = null
    this.wrapper?.remove()
    this.wrapper = null
  }
}
