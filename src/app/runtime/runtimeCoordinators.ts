import type { Theme } from '@/services/renderer/theme'
import { ExportAndOverlayCoordinator } from '@/services/runtime/ExportAndOverlayCoordinator'
import { MidiFlowCoordinator } from '@/services/runtime/MidiFlowCoordinator'
import { PlaybackCoordinator } from '@/services/runtime/PlaybackCoordinator'

export interface CreateRuntimeCoordinatorsOptions {
  playback: ConstructorParameters<typeof PlaybackCoordinator>[0]
  midiFlow: ConstructorParameters<typeof MidiFlowCoordinator>[0]
  exportOverlay: ConstructorParameters<typeof ExportAndOverlayCoordinator>[0]
  initialTheme: Theme
}

export interface RuntimeCoordinatorBundle {
  playback: PlaybackCoordinator
  midiFlow: MidiFlowCoordinator
  exportOverlay: ExportAndOverlayCoordinator
}

export function createRuntimeCoordinators(
  options: CreateRuntimeCoordinatorsOptions,
): RuntimeCoordinatorBundle {
  const playback = new PlaybackCoordinator(options.playback)
  const midiFlow = new MidiFlowCoordinator(options.midiFlow)
  const exportOverlay = new ExportAndOverlayCoordinator(options.exportOverlay)

  exportOverlay.syncConsolePanel()
  exportOverlay.applyChordOverlayVisibility()
  exportOverlay.applyTheme(options.initialTheme)
  exportOverlay.applyInstrument()
  exportOverlay.applyParticleStyle()

  return {
    playback,
    midiFlow,
    exportOverlay,
  }
}
