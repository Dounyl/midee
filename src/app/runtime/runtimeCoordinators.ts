import { ExportFlowService } from '@/services/export/ExportFlowService'
import { RuntimeOverlayController } from '@/services/export/RuntimeOverlayController'
import type { Theme } from '@/services/renderer/theme'
import { MidiFlowCoordinator } from '@/services/runtime/MidiFlowCoordinator'
import { PlaybackCoordinator } from '@/services/runtime/PlaybackCoordinator'

export interface CreateRuntimeCoordinatorsOptions {
  playback: ConstructorParameters<typeof PlaybackCoordinator>[0]
  midiFlow: ConstructorParameters<typeof MidiFlowCoordinator>[0]
  exportFlow: ConstructorParameters<typeof ExportFlowService>[0]
  runtimeOverlay: ConstructorParameters<typeof RuntimeOverlayController>[0]
  initialTheme: Theme
}

export interface RuntimeCoordinatorBundle {
  playback: PlaybackCoordinator
  midiFlow: MidiFlowCoordinator
  exportFlow: ExportFlowService
  runtimeOverlay: RuntimeOverlayController
}

export function createRuntimeCoordinators(
  options: CreateRuntimeCoordinatorsOptions,
): RuntimeCoordinatorBundle {
  const playback = new PlaybackCoordinator(options.playback)
  const midiFlow = new MidiFlowCoordinator(options.midiFlow)
  const exportFlow = new ExportFlowService(options.exportFlow)
  const runtimeOverlay = new RuntimeOverlayController(options.runtimeOverlay)

  runtimeOverlay.syncConsolePanel()
  runtimeOverlay.applyChordOverlayVisibility()
  runtimeOverlay.applyTheme(options.initialTheme)
  runtimeOverlay.applyInstrument()
  runtimeOverlay.applyParticleStyle()

  return {
    playback,
    midiFlow,
    exportFlow,
    runtimeOverlay,
  }
}
