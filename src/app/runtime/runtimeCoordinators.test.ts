import { describe, expect, it, vi } from 'vitest'
import { createRuntimeCoordinators } from '@/app/runtime/runtimeCoordinators'

const playbackInstances: Array<{ options: unknown }> = []
const midiFlowInstances: Array<{ options: unknown }> = []
const exportFlowInstances: Array<{ options: unknown }> = []
const runtimeOverlayInstances: Array<{
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

vi.mock('@/services/export/ExportFlowService', () => ({
  ExportFlowService: class {
    constructor(public options: unknown) {
      exportFlowInstances.push(this)
    }
  },
}))

vi.mock('@/services/export/RuntimeOverlayController', () => ({
  RuntimeOverlayController: class {
    syncConsolePanel = vi.fn()
    applyChordOverlayVisibility = vi.fn()
    applyTheme = vi.fn()
    applyInstrument = vi.fn()
    applyParticleStyle = vi.fn()

    constructor(public options: unknown) {
      runtimeOverlayInstances.push(this)
    }
  },
}))

describe('createRuntimeCoordinators', () => {
  it('creates coordinators and applies initial overlay sync', async () => {
    const bundle = createRuntimeCoordinators({
      playback: { id: 'playback-opts' } as never,
      midiFlow: { id: 'midi-flow-opts' } as never,
      exportFlow: { id: 'export-flow-opts' } as never,
      runtimeOverlay: { id: 'runtime-overlay-opts' } as never,
      initialTheme: { id: 'theme' } as never,
    })

    expect(playbackInstances[0]?.options).toEqual({ id: 'playback-opts' })
    expect(midiFlowInstances[0]?.options).toEqual({ id: 'midi-flow-opts' })
    expect(exportFlowInstances[0]?.options).toEqual({ id: 'export-flow-opts' })
    expect(runtimeOverlayInstances[0]?.options).toEqual({ id: 'runtime-overlay-opts' })
    expect(runtimeOverlayInstances[0]?.syncConsolePanel).toHaveBeenCalledOnce()
    expect(runtimeOverlayInstances[0]?.applyChordOverlayVisibility).toHaveBeenCalledOnce()
    expect(runtimeOverlayInstances[0]?.applyTheme).toHaveBeenCalledWith({ id: 'theme' })
    expect(runtimeOverlayInstances[0]?.applyInstrument).toHaveBeenCalledOnce()
    expect(runtimeOverlayInstances[0]?.applyParticleStyle).toHaveBeenCalledOnce()
    expect(bundle.playback).toBe(playbackInstances[0])
    expect(bundle.midiFlow).toBe(midiFlowInstances[0])
    expect(bundle.exportFlow).toBe(exportFlowInstances[0])
    expect(bundle.runtimeOverlay).toBe(runtimeOverlayInstances[0])
  })
})
