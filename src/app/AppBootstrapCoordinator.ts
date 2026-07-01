import type { AppServices } from '../core/services'
import { getKeyboardHeightProfile } from '../core/keyboardLayout'
import type { PianoRollRenderer } from '../renderer/PianoRollRenderer'
import { PARTICLE_STYLES, type ParticleStyleInfo } from '../renderer/ParticleSystem'
import { THEMES, type Theme } from '../renderer/theme'
import { ChordOverlay } from '../ui/ChordOverlay'
import { ConsolePanel } from '../ui/ConsolePanel'
import { Controls } from '../ui/Controls'
import { CustomizeMenu } from '../ui/CustomizeMenu'
import { DropZone } from '../ui/DropZone'
import { InstrumentMenu } from '../ui/InstrumentMenu'
import { KeyboardResizer } from '../ui/KeyboardResizer'
import { TrackPanel } from '../ui/TrackPanel'
import { installViewportClassSync } from '../ui/utils'
import type { AppActions } from '../store/AppCtx'
import type { RuntimeUiCallbacks } from './types'
import { RuntimeUiBridge } from './RuntimeUiBridge'

interface AppBootstrapCoordinatorOptions {
  services: AppServices
  actions: AppActions
  renderer: PianoRollRenderer
  skipHomeIntro: boolean
  initialHidden: boolean
  onTrackEnabledChange: (trackId: string, enabled: boolean) => void
  callbacks: RuntimeUiCallbacks
}

export class AppBootstrapCoordinator {
  constructor(private readonly opts: AppBootstrapCoordinatorOptions) {}

  async start(): Promise<{
    canvas: HTMLCanvasElement
    overlay: HTMLElement
    ui: RuntimeUiBridge
  }> {
    const canvas = document.querySelector<HTMLCanvasElement>('#pianoroll')!
    const overlay = document.querySelector<HTMLElement>('#ui-overlay')!

    installViewportClassSync()
    await this.opts.renderer.init(canvas)

    const controls = new Controls({
      container: overlay,
      services: this.opts.services,
      actions: this.opts.actions,
      onSeek: this.opts.callbacks.onSeek,
      onZoom: this.opts.callbacks.onZoom,
      onThemeCycle: this.opts.callbacks.onThemeCycle,
      onMidiConnect: this.opts.callbacks.onMidiConnect,
      onOpenTracks: this.opts.callbacks.onOpenTracks,
      onRecord: this.opts.callbacks.onRecord,
      onTransposeChange: this.opts.callbacks.onTransposeChange,
      onInstrumentCycle: this.opts.callbacks.onInstrumentCycle,
      onParticleCycle: this.opts.callbacks.onParticleCycle,
      onLoopToggle: this.opts.callbacks.onLoopToggle,
      onLoopClear: this.opts.callbacks.onLoopClear,
      onLoopSave: this.opts.callbacks.onLoopSave,
      onLoopUndo: this.opts.callbacks.onLoopUndo,
      onMetronomeToggle: this.opts.callbacks.onMetronomeToggle,
      onMetronomeBpmChange: this.opts.callbacks.onMetronomeBpmChange,
      onSessionToggle: this.opts.callbacks.onSessionToggle,
      onChordToggle: this.opts.callbacks.onChordToggle,
      onOctaveShift: this.opts.callbacks.onOctaveShift,
    })

    const dropzone = new DropZone(
      overlay,
      this.opts.callbacks.onDropFile,
      this.opts.callbacks.onEnterLiveMode,
      this.opts.callbacks.onOpenSamplePlay,
      this.opts.callbacks.onOpenSampleLearn,
      this.opts.callbacks.onEnterLearnMode,
      this.opts.skipHomeIntro,
      this.opts.callbacks.onSkipHomeIntroChange,
      this.opts.initialHidden,
    )

    const trackPanel = new TrackPanel(
      overlay,
      this.opts.renderer,
      this.opts.onTrackEnabledChange,
      () => void this.opts.actions.library.open({ kind: 'picker' }),
    )
    trackPanel.setTrigger(controls.tracksButton)

    const consolePanel = new ConsolePanel(
      overlay,
      this.opts.callbacks.onTransposeChange,
      this.opts.callbacks.onResetToTonic,
      () => {},
      this.opts.callbacks.onPitchLabelsVisibleChange,
    )

    const instrumentMenu = new InstrumentMenu(controls.instrumentSlot, overlay)
    instrumentMenu.onSelect = this.opts.callbacks.onSelectInstrument as never

    const keyboardResizer = new KeyboardResizer(
      overlay,
      () => this.opts.renderer.currentKeyboardHeight,
      () => this.opts.renderer.currentKeyboardMode,
      (px: number) => this.opts.renderer.setKeyboardHeight(px),
      (mode) => getKeyboardHeightProfile(mode).desktop,
    )

    const chordOverlay = new ChordOverlay(controls.chordSlot)
    const customizeMenu = new CustomizeMenu(
      controls.customizeSlot,
      overlay,
      THEMES,
      PARTICLE_STYLES as readonly ParticleStyleInfo[],
      {
        onSelectTheme: this.opts.callbacks.onSelectTheme,
        onSelectParticle: this.opts.callbacks.onSelectParticle,
        onToggleChord: this.opts.callbacks.onToggleChordFromMenu,
        onSelectLocale: this.opts.callbacks.onSelectLocale as never,
      },
    )

    return {
      canvas,
      overlay,
      ui: new RuntimeUiBridge({
        controls,
        dropzone,
        trackPanel,
        consolePanel,
        instrumentMenu,
        keyboardResizer,
        chordOverlay,
        customizeMenu,
      }),
    }
  }
}
