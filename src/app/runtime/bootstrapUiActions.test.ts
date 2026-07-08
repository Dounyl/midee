import { describe, expect, it, vi } from 'vitest'
import {
  createBootstrapRuntimeUiConsole,
  createBootstrapRuntimeUiControls,
  createBootstrapRuntimeUiMenus,
  createBootstrapRuntimeUiPlayback,
} from '@/app/runtime/bootstrapUiActions'
import type { InstrumentId } from '@/services/audio/instruments'
import { track, trackEvent, trackEventSettled } from '@/services/telemetry'

vi.mock('@/services/telemetry', () => ({
  track: vi.fn(),
  trackEvent: vi.fn(),
  trackEventSettled: vi.fn(),
}))

describe('bootstrapUiActions', () => {
  it('builds control callbacks from narrow dependencies', async () => {
    const seek = vi.fn()
    const openExport = vi.fn()
    const clearLoop = vi.fn()
    const setMetronomeBpm = vi.fn()
    const persistMetronomeBpm = vi.fn()
    const shiftOctave = vi.fn()
    const controls = createBootstrapRuntimeUiControls({
      seek,
      zoom: vi.fn(),
      cycleTheme: vi.fn(),
      connectMidi: vi.fn(),
      openTracks: vi.fn(),
      openExport,
      hasLoadedMidi: () => true,
      setTranspose: vi.fn(),
      cycleInstrument: vi.fn(),
      cycleParticleStyle: vi.fn(),
      toggleLoop: vi.fn(),
      getLoopLayerCount: () => 2,
      clearLoop,
      saveLoopAsMidi: vi.fn(),
      undoLoop: vi.fn(),
      toggleMetronome: vi.fn(),
      isMetronomeRunning: () => true,
      setMetronomeBpm,
      getMetronomeBpm: () => 132,
      persistMetronomeBpm,
      toggleSessionRecord: vi.fn(),
      toggleChordOverlay: vi.fn(),
      shiftOctave,
    })

    controls.onSeek?.(12)
    controls.onRecord?.()
    controls.onLoopClear?.()
    controls.onMetronomeBpmChange?.(140)
    controls.onOctaveShift?.(-1)

    expect(seek).toHaveBeenCalledWith(12)
    expect(openExport).toHaveBeenCalledOnce()
    expect(clearLoop).toHaveBeenCalledOnce()
    expect(setMetronomeBpm).toHaveBeenCalledWith(140)
    expect(persistMetronomeBpm).toHaveBeenCalledWith(132)
    expect(shiftOctave).toHaveBeenCalledWith(-1)
    expect(track).toHaveBeenCalledWith('export_opened', { has_midi: true })
    expect(track).toHaveBeenCalledWith('loop_cleared', { layers: 2 })
    expect(trackEventSettled).toHaveBeenCalledWith('tempo_changed', { bpm: 132 })
  })

  it('builds playback callbacks from narrow dependencies', () => {
    const openDroppedMidi = vi.fn()
    const setTrackEnabled = vi.fn()
    const openFilePicker = vi.fn()
    const selectInstrument = vi.fn()
    const playback = createBootstrapRuntimeUiPlayback({
      renderer: { kind: 'renderer' } as never,
      openDroppedMidi,
      setTrackEnabled,
      openFilePicker,
      selectInstrument,
    })

    const file = new File(['x'], 'demo.mid')
    playback.onDrop(file, 'picker')
    playback.panels.onTrackEnabledChange('track-1', true)
    playback.panels.onLoadNew()
    playback.panels.onSelectInstrument('piano' satisfies InstrumentId)

    expect(playback.panels.renderer).toEqual({ kind: 'renderer' })
    expect(openDroppedMidi).toHaveBeenCalledWith(file, 'picker')
    expect(setTrackEnabled).toHaveBeenCalledWith('track-1', true)
    expect(openFilePicker).toHaveBeenCalledOnce()
    expect(selectInstrument).toHaveBeenCalledWith('piano')
    expect(trackEvent).toHaveBeenCalledWith('track_toggled', { enabled: true })
  })

  it('builds menu callbacks from narrow dependencies', () => {
    const setThemeByIndex = vi.fn()
    const setParticleByIndex = vi.fn()
    const toggleChordOverlay = vi.fn()
    const menus = createBootstrapRuntimeUiMenus({
      chordOverlayOn: true,
      setThemeByIndex,
      setParticleByIndex,
      toggleChordOverlay,
    })

    menus.customize.onSelectTheme(2)
    menus.customize.onSelectParticle(3)
    menus.customize.onToggleChord()

    expect(menus.chordOverlayOn).toBe(true)
    expect(setThemeByIndex).toHaveBeenCalledWith(2)
    expect(setParticleByIndex).toHaveBeenCalledWith(3)
    expect(toggleChordOverlay).toHaveBeenCalledOnce()
  })

  it('builds console callbacks from narrow dependencies', () => {
    const handleTransposeChange = vi.fn()
    const requestKeyboardModeChange = vi.fn()
    const setPitchLabelsVisible = vi.fn()
    const consoleUi = createBootstrapRuntimeUiConsole({
      handleTransposeChange,
      getLearnBaseKey: () =>
        ({ tonic: 'D', mode: 'major', source: 'midi', confidence: 1 }) as never,
      getPlayBaseKey: () => ({ tonic: 'G', mode: 'major', source: 'midi', confidence: 1 }) as never,
      getCurrentTranspose: () => 2,
      includeLearnBaseKey: () => true,
      requestKeyboardModeChange,
      getActiveMidi: () => ({ id: 'midi' }) as never,
      setPitchLabelsVisible,
    })

    consoleUi.console.onChange(4)
    consoleUi.console.onResetToC()
    consoleUi.console.onKeyboardModeChange('61')
    consoleUi.console.onToggleLabels(true)

    expect(handleTransposeChange).toHaveBeenCalledWith(4)
    expect(handleTransposeChange).toHaveBeenCalledTimes(2)
    expect(requestKeyboardModeChange).toHaveBeenCalledWith('61', {
      activeMidi: { id: 'midi' },
      currentTranspose: 2,
      onTranspose: expect.any(Function),
    })
    expect(setPitchLabelsVisible).toHaveBeenCalledWith(true)
  })
})
