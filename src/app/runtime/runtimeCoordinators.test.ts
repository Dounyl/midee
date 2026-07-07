import { describe, expect, it, vi } from 'vitest'
import { createRuntimeCoordinators } from '@/app/runtime/runtimeCoordinators'

const playbackInstances: Array<{ options: unknown }> = []
const midiFlowInstances: Array<{ options: unknown }> = []
const exportOverlayInstances: Array<{
  options: unknown
  syncConsolePanel: ReturnType<typeof vi.fn>
  applyChordOverlayVisibility: ReturnType<typeof vi.fn>
  applyTheme: ReturnType<typeof vi.fn>
  applyInstrument: ReturnType<typeof vi.fn>
  applyParticleStyle: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/services/runtime/PlaybackCoordinator', () => ({
  PlaybackCoordinator: class {
    constructor(public options: unknown) {
      playbackInstances.push(this)
    }
  },
}))

vi.mock('@/services/runtime/MidiFlowCoordinator', () => ({
  MidiFlowCoordinator: class {
    constructor(public options: unknown) {
      midiFlowInstances.push(this)
    }
  },
}))

vi.mock('@/services/runtime/ExportAndOverlayCoordinator', () => ({
  ExportAndOverlayCoordinator: class {
    syncConsolePanel = vi.fn()
    applyChordOverlayVisibility = vi.fn()
    applyTheme = vi.fn()
    applyInstrument = vi.fn()
    applyParticleStyle = vi.fn()

    constructor(public options: unknown) {
      exportOverlayInstances.push(this)
    }
  },
}))

describe('createRuntimeCoordinators', () => {
  it('creates coordinators and applies initial overlay sync', async () => {
    const bundle = createRuntimeCoordinators({
      playback: { id: 'playback-opts' } as never,
      midiFlow: { id: 'midi-flow-opts' } as never,
      exportOverlay: { id: 'export-overlay-opts' } as never,
      initialTheme: { id: 'theme' } as never,
    })

    expect(playbackInstances[0]?.options).toEqual({ id: 'playback-opts' })
    expect(midiFlowInstances[0]?.options).toEqual({ id: 'midi-flow-opts' })
    expect(exportOverlayInstances[0]?.options).toEqual({ id: 'export-overlay-opts' })
    expect(exportOverlayInstances[0]?.syncConsolePanel).toHaveBeenCalledOnce()
    expect(exportOverlayInstances[0]?.applyChordOverlayVisibility).toHaveBeenCalledOnce()
    expect(exportOverlayInstances[0]?.applyTheme).toHaveBeenCalledWith({ id: 'theme' })
    expect(exportOverlayInstances[0]?.applyInstrument).toHaveBeenCalledOnce()
    expect(exportOverlayInstances[0]?.applyParticleStyle).toHaveBeenCalledOnce()
    expect(bundle.playback).toBe(playbackInstances[0])
    expect(bundle.midiFlow).toBe(midiFlowInstances[0])
    expect(bundle.exportOverlay).toBe(exportOverlayInstances[0])
  })
})
