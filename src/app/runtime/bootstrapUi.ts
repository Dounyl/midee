import { type CreateConsolePanelOptions, createConsolePanel } from '@/app/runtime/bootstrapConsole'
import { ChordOverlay } from '@/components/playback/ChordOverlay'
import type { ConsolePanel } from '@/components/playback/ConsolePanel'
import { type ControlsProps, createControls } from '@/components/playback/Controls'
import { CustomizeMenu } from '@/components/playback/CustomizeMenu'
import { DropZone, type LoadSource } from '@/components/playback/DropZone'
import { InstrumentMenu } from '@/components/playback/InstrumentMenu'
import { TrackPanel } from '@/components/playback/TrackPanel'
import { setLocale } from '@/i18n'
import { PARTICLE_STYLES } from '@/services/renderer/ParticleSystem'
import type { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import { THEMES } from '@/services/renderer/theme'
import { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'
import type { AppActions } from '@/stores/app/AppCtx'
import type { AppServices } from '@/types/app/AppServices'

interface CreateCustomizeMenuOptions {
  triggerHost: HTMLElement
  overlay: HTMLElement
  chordOn: boolean
  onSelectTheme(index: number): void
  onSelectParticle(index: number): void
  onToggleChord(): void
}

interface CreatePlaybackPanelsOptions {
  overlay: HTMLElement
  renderer: PianoRollRenderer
  instrumentTriggerHost: HTMLElement
  tracksTrigger: HTMLElement
  onTrackEnabledChange(trackId: string, enabled: boolean): void
  onLoadNew(): void
  onSelectInstrument(id: Parameters<NonNullable<InstrumentMenu['onSelect']>>[0]): void
}

interface BootstrapPlaybackPanelsOptions {
  renderer: PianoRollRenderer
  onTrackEnabledChange(trackId: string, enabled: boolean): void
  onLoadNew(): void
  onSelectInstrument(id: Parameters<NonNullable<InstrumentMenu['onSelect']>>[0]): void
}

export interface BootstrapRuntimeUiControlsOptions
  extends Omit<ControlsProps, 'services' | 'actions'> {}

export interface BootstrapRuntimeUiPlaybackOptions {
  onDrop(file: File, source: LoadSource): void
  panels: BootstrapPlaybackPanelsOptions
}

export interface BootstrapRuntimeUiMenuOptions {
  chordOverlayOn: boolean
  customize: Omit<CreateCustomizeMenuOptions, 'triggerHost' | 'overlay' | 'chordOn'>
}

export interface BootstrapRuntimeUiOverlayOptions {
  console: Omit<CreateConsolePanelOptions, 'container'>
}

export interface BootstrapRuntimeUiOptions {
  overlay: HTMLElement
  services: AppServices
  actions: AppActions
  controls: BootstrapRuntimeUiControlsOptions
  playback: BootstrapRuntimeUiPlaybackOptions
  menus: BootstrapRuntimeUiMenuOptions
  overlayUi: BootstrapRuntimeUiOverlayOptions
}

export interface BootstrapRuntimeUiResult {
  ui: RuntimeUiBridge
}

interface BootstrapMenuResult {
  customizeMenu: CustomizeMenu
  chordOverlay: ChordOverlay
}

interface BootstrapPlaybackResult {
  dropzone: DropZone
  trackPanel: TrackPanel
  instrumentMenu: InstrumentMenu
}

function bootstrapConsoleUi(
  overlay: HTMLElement,
  options: BootstrapRuntimeUiOverlayOptions,
): ConsolePanel {
  return createConsolePanel({
    container: overlay,
    ...options.console,
  })
}

function createCustomizeMenu(options: CreateCustomizeMenuOptions): CustomizeMenu {
  const menu = new CustomizeMenu(options.triggerHost, options.overlay, THEMES, PARTICLE_STYLES, {
    onSelectTheme: options.onSelectTheme,
    onSelectParticle: options.onSelectParticle,
    onToggleChord: options.onToggleChord,
    // Locale change is rare, and almost every part of the UI was built
    // with the previous locale baked in via template literals. Reload
    // is the simplest correct path: persistence happens in setLocale,
    // boot picks it up, the next paint is fully translated. No stale
    // strings, no in-place re-render machinery to maintain.
    onSelectLocale: (code) => {
      void setLocale(code).then(() => window.location.reload())
    },
  })
  menu.setChord(options.chordOn)
  return menu
}

function createPlaybackPanels(options: CreatePlaybackPanelsOptions): {
  trackPanel: TrackPanel
  instrumentMenu: InstrumentMenu
} {
  const trackPanel = new TrackPanel(
    options.overlay,
    options.renderer,
    options.onTrackEnabledChange,
    options.onLoadNew,
  )
  trackPanel.setTrigger(options.tracksTrigger)

  const instrumentMenu = new InstrumentMenu(options.instrumentTriggerHost, options.overlay)
  instrumentMenu.onSelect = options.onSelectInstrument

  return {
    trackPanel,
    instrumentMenu,
  }
}

function bootstrapPlaybackUi(
  controls: ReturnType<typeof createControls>,
  overlay: HTMLElement,
  options: BootstrapRuntimeUiPlaybackOptions,
): BootstrapPlaybackResult {
  const dropzone = new DropZone(overlay, (file, source) => options.onDrop(file, source), true)
  const { trackPanel, instrumentMenu } = createPlaybackPanels({
    overlay,
    renderer: options.panels.renderer,
    instrumentTriggerHost: controls.instrumentSlot,
    tracksTrigger: controls.tracksButton,
    onTrackEnabledChange: options.panels.onTrackEnabledChange,
    onLoadNew: options.panels.onLoadNew,
    onSelectInstrument: options.panels.onSelectInstrument,
  })
  return { dropzone, trackPanel, instrumentMenu }
}

function bootstrapMenusUi(
  controls: ReturnType<typeof createControls>,
  overlay: HTMLElement,
  options: BootstrapRuntimeUiMenuOptions,
): BootstrapMenuResult {
  const chordOverlay = new ChordOverlay(controls.chordSlot)
  const customizeMenuInstance = createCustomizeMenu({
    triggerHost: controls.customizeSlot,
    overlay,
    chordOn: options.chordOverlayOn,
    ...options.customize,
  })
  return {
    chordOverlay,
    customizeMenu: customizeMenuInstance,
  }
}

function bootstrapOverlayUi(parts: {
  controls: ReturnType<typeof createControls>
  dropzone: DropZone
  trackPanel: TrackPanel
  consolePanel: ConsolePanel
  instrumentMenu: InstrumentMenu
  chordOverlay: ChordOverlay
  customizeMenu: CustomizeMenu
}): RuntimeUiBridge {
  return new RuntimeUiBridge(parts)
}

export function bootstrapRuntimeUi(options: BootstrapRuntimeUiOptions): BootstrapRuntimeUiResult {
  const controls = createControls(options.overlay, {
    services: options.services,
    actions: options.actions,
    ...options.controls,
  })
  const { dropzone, trackPanel, instrumentMenu } = bootstrapPlaybackUi(
    controls,
    options.overlay,
    options.playback,
  )
  const { chordOverlay, customizeMenu: customizeMenuInstance } = bootstrapMenusUi(
    controls,
    options.overlay,
    options.menus,
  )
  const consolePanel = bootstrapConsoleUi(options.overlay, options.overlayUi)
  const ui = bootstrapOverlayUi({
    controls,
    dropzone,
    trackPanel,
    consolePanel,
    instrumentMenu,
    chordOverlay,
    customizeMenu: customizeMenuInstance,
  })
  return {
    ui,
  }
}
