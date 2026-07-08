import { describe, expect, it, vi } from 'vitest'

const controlsInstances: any[] = []
const dropZoneInstances: any[] = []
const trackPanelInstances: any[] = []
const instrumentMenuInstances: any[] = []
const customizeMenuInstances: any[] = []
const chordOverlayInstances: any[] = []

vi.mock('@/components/playback/Controls', () => ({
  createControls: (_overlay: HTMLElement, options: unknown) => {
    const instance = {
      instrumentSlot: document.createElement('div'),
      tracksButton: document.createElement('button'),
      customizeSlot: document.createElement('div'),
      chordSlot: document.createElement('div'),
      options,
    }
    controlsInstances.push(instance)
    return instance
  },
}))

vi.mock('@/components/playback/DropZone', () => ({
  DropZone: class {
    constructor(
      public overlay: HTMLElement,
      public onDrop: (file: File, source: string) => void,
      public immediate: boolean,
    ) {
      dropZoneInstances.push(this)
    }
  },
}))

vi.mock('@/components/playback/TrackPanel', () => ({
  TrackPanel: class {
    trigger: HTMLElement | null = null
    constructor(...args: unknown[]) {
      this.args = args
      trackPanelInstances.push(this)
    }
    args: unknown[]
    setTrigger(trigger: HTMLElement) {
      this.trigger = trigger
    }
  },
}))

vi.mock('@/components/playback/InstrumentMenu', () => ({
  InstrumentMenu: class {
    onSelect: ((id: string) => void) | null = null
    constructor(...args: unknown[]) {
      this.args = args
      instrumentMenuInstances.push(this)
    }
    args: unknown[]
  },
}))

vi.mock('@/components/playback/CustomizeMenu', () => ({
  CustomizeMenu: class {
    chord = false
    constructor(...args: unknown[]) {
      this.args = args
      customizeMenuInstances.push(this)
    }
    args: unknown[]
    setChord(value: boolean) {
      this.chord = value
    }
  },
}))

vi.mock('@/components/playback/ChordOverlay', () => ({
  ChordOverlay: class {
    constructor(public host: HTMLElement) {
      chordOverlayInstances.push(this)
    }
  },
}))

vi.mock('@/app/runtime/bootstrapConsole', () => ({
  createConsolePanel: vi.fn((_options: unknown) => ({ kind: 'console-panel' })),
}))

describe('bootstrapRuntimeUi', () => {
  it('bootstraps the runtime ui and wires panel triggers through the bridge', async () => {
    const { bootstrapRuntimeUi } = await import('@/app/runtime/bootstrapUi')
    const overlay = document.createElement('div')
    const onDrop = vi.fn()
    const onTrackEnabledChange = vi.fn()
    const onSelectInstrument = vi.fn()

    const result = bootstrapRuntimeUi({
      overlay,
      services: {} as never,
      actions: {} as never,
      controls: {
        onSeek: vi.fn(),
        onZoom: vi.fn(),
        onThemeCycle: vi.fn(),
        onMidiConnect: vi.fn(),
        onOpenTracks: vi.fn(),
        onRecord: vi.fn(),
        onTransposeChange: vi.fn(),
        onInstrumentCycle: vi.fn(),
        onParticleCycle: vi.fn(),
        onLoopToggle: vi.fn(),
        onLoopClear: vi.fn(),
        onLoopSave: vi.fn(),
        onLoopUndo: vi.fn(),
        onMetronomeToggle: vi.fn(),
        onMetronomeBpmChange: vi.fn(),
        onSessionToggle: vi.fn(),
        onChordToggle: vi.fn(),
        onOctaveShift: vi.fn(),
      },
      playback: {
        onDrop,
        panels: {
          renderer: {} as never,
          onTrackEnabledChange,
          onLoadNew: vi.fn(),
          onSelectInstrument,
        },
      },
      menus: {
        chordOverlayOn: true,
        customize: {
          onSelectTheme: vi.fn(),
          onSelectParticle: vi.fn(),
          onToggleChord: vi.fn(),
        },
      },
      overlayUi: {
        console: {
          onChange: vi.fn(),
          onResetToC: vi.fn(),
          onKeyboardModeChange: vi.fn(),
          onToggleLabels: vi.fn(),
        },
      },
    })

    expect(result.ui.controls).toBe(controlsInstances[0])
    expect(result.ui.dropzone).toBe(dropZoneInstances[0])
    expect(result.ui.trackPanel).toBe(trackPanelInstances[0])
    expect(result.ui.instrumentMenu).toBe(instrumentMenuInstances[0])
    expect(result.ui.customizeMenu).toBe(customizeMenuInstances[0])
    expect(result.ui.chordOverlay).toBe(chordOverlayInstances[0])
    expect(trackPanelInstances[0]?.trigger).toBe(controlsInstances[0]?.tracksButton)
    expect(customizeMenuInstances[0]?.chord).toBe(true)

    const file = new File(['x'], 'demo.mid')
    dropZoneInstances[0]?.onDrop(file, 'picker')
    expect(onDrop).toHaveBeenCalledWith(file, 'picker')
    expect(instrumentMenuInstances[0]?.onSelect).toBe(onSelectInstrument)
  })
})
