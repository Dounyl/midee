import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import type { MidiFile } from '@/types/midi/types'
import { createAppStore } from '../../stores/app/state'
import {
  applyHomeRouteEntry,
  applyLiveRouteEntry,
  applyPlayRouteEntry,
  syncLoadedMidiForCurrentRoute,
} from './routeEntry'

const telemetryMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/telemetry', () => ({
  track: telemetryMocks.track,
  trackEvent: telemetryMocks.trackEvent,
}))

function fakeMidi(name = 'demo.mid', duration = 12.5): MidiFile {
  return { name, duration, bpm: 120, timeSignature: [4, 4], keySignature: null, tracks: [] }
}

function makeRouteEntryShell() {
  return {
    renderer: { clearMidi: vi.fn(), loadMidi: vi.fn() },
    trackPanel: { close: vi.fn(), render: vi.fn() },
    dropzone: { show: vi.fn(), hide: vi.fn() },
    keyboardInput: { enable: vi.fn() },
    resetInteractionState: vi.fn(),
  }
}

describe('route entry helpers', () => {
  beforeEach(() => {
    telemetryMocks.track.mockReset()
    telemetryMocks.trackEvent.mockReset()
    document.title = ''
  })

  it('applyHomeRouteEntry resets state and syncs the home shell', () => {
    const store = createAppStore()
    const shell = makeRouteEntryShell()
    store.completePlayLoad(fakeMidi())
    store.setState('currentTime', 4.2)
    store.setState('status', 'playing')

    expect(() => {
      applyHomeRouteEntry(store, shell)
      applyHomeRouteEntry(store, shell)
    }).not.toThrow()

    expect(shell.resetInteractionState).toHaveBeenCalledTimes(2)
    expect(store.state.loadedMidi).toBeNull()
    expect(store.state.currentTime).toBe(0)
    expect(store.state.status).toBe('idle')
    expect(shell.renderer.clearMidi).toHaveBeenCalledTimes(2)
    expect(shell.trackPanel.close).toHaveBeenCalledTimes(2)
    expect(shell.dropzone.show).toHaveBeenCalledTimes(2)
    expect(shell.keyboardInput.enable).toHaveBeenCalledTimes(2)
    expect(document.title).toBe(t('doc.title.home'))
  })

  it('applyLiveRouteEntry marks the store ready and syncs the live shell', () => {
    const store = createAppStore()
    const shell = makeRouteEntryShell()
    store.setState('currentTime', 9)
    store.setState('status', 'paused')

    expect(() => {
      applyLiveRouteEntry(store, shell)
      applyLiveRouteEntry(store, shell)
    }).not.toThrow()

    expect(shell.resetInteractionState).toHaveBeenCalledTimes(2)
    expect(store.state.status).toBe('ready')
    expect(store.state.currentTime).toBe(0)
    expect(shell.renderer.clearMidi).toHaveBeenCalledTimes(2)
    expect(shell.trackPanel.close).toHaveBeenCalledTimes(2)
    expect(shell.dropzone.hide).toHaveBeenCalledTimes(2)
    expect(shell.keyboardInput.enable).toHaveBeenCalledTimes(2)
    expect(document.title).toBe(t('doc.title.live'))
  })

  it('applyPlayRouteEntry opens the play landing when no MIDI is loaded', () => {
    const store = createAppStore()
    const shell = makeRouteEntryShell()
    store.setState('currentTime', 3)

    applyPlayRouteEntry(store, shell)

    expect(store.state.status).toBe('idle')
    expect(store.state.loadedMidi).toBeNull()
    expect(store.state.currentTime).toBe(0)
    expect(shell.renderer.clearMidi).toHaveBeenCalledOnce()
    expect(shell.trackPanel.close).toHaveBeenCalledOnce()
    expect(shell.dropzone.hide).toHaveBeenCalledOnce()
    expect(shell.keyboardInput.enable).toHaveBeenCalledOnce()
    expect(telemetryMocks.track).not.toHaveBeenCalled()
    expect(telemetryMocks.trackEvent).not.toHaveBeenCalled()
  })

  it('applyPlayRouteEntry loads the play shell and only tracks analytics when requested', () => {
    const store = createAppStore()
    const shell = makeRouteEntryShell()
    const midi = fakeMidi('song.mid', 20)
    store.completePlayLoad(midi)
    store.setState('currentTime', 7.5)
    store.setState('status', 'paused')

    applyPlayRouteEntry(store, shell, { skipAnalytics: true })

    expect(store.state.status).toBe('ready')
    expect(store.state.currentTime).toBe(7.5)
    expect(shell.renderer.loadMidi).toHaveBeenCalledWith(midi)
    expect(shell.trackPanel.render).toHaveBeenCalledWith(midi)
    expect(shell.dropzone.hide).toHaveBeenCalledOnce()
    expect(shell.keyboardInput.enable).toHaveBeenCalledOnce()
    expect(telemetryMocks.track).not.toHaveBeenCalled()
    expect(telemetryMocks.trackEvent).not.toHaveBeenCalled()

    applyPlayRouteEntry(store, shell)

    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith('play_mode_entered', { duration_s: 20 })
    expect(telemetryMocks.track).toHaveBeenCalledWith('file_mode_entered', { duration_s: 20 })
    expect(document.title).toBe('song.mid - midee')
  })

  it('syncLoadedMidiForCurrentRoute resyncs play without replaying analytics', () => {
    const enterPlayRoute = vi.fn()
    const syncConsolePanel = vi.fn()

    syncLoadedMidiForCurrentRoute({
      syncConsolePanel,
      currentRouteTarget: () => ({ kind: 'play' }),
      enterPlayRoute,
    })

    expect(syncConsolePanel).toHaveBeenCalledOnce()
    expect(enterPlayRoute).toHaveBeenCalledWith({ skipAnalytics: true })
    expect(telemetryMocks.track).not.toHaveBeenCalled()
    expect(telemetryMocks.trackEvent).not.toHaveBeenCalled()
  })
})
