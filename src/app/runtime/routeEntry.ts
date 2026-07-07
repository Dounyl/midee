import { t } from '@/i18n'
import { track, trackEvent } from '@/services/telemetry'
import type { PlayRouteEnterOptions } from '@/stores/app/AppCtx'
import type { AppStore } from '@/stores/app/state'
import type { RouteTarget } from '@/stores/routing/routeTarget'
import { isPlayRouteTarget } from '@/stores/routing/routeTarget'

interface RouteEntryShell {
  renderer: {
    clearMidi(): void
    loadMidi(midi: NonNullable<AppStore['state']['loadedMidi']>): void
  }
  trackPanel: {
    close(): void
    render(midi: NonNullable<AppStore['state']['loadedMidi']>): void
  }
  dropzone: {
    show(): void
    hide(): void
  }
  keyboardInput: {
    enable(): void
  }
  resetInteractionState(): void
}

interface RouteSyncShell {
  syncConsolePanel(): void
  currentRouteTarget(): RouteTarget | null
  enterPlayRoute(options?: PlayRouteEnterOptions): void
}

export function applyPlayRouteEntry(
  store: AppStore,
  shell: Omit<RouteEntryShell, 'resetInteractionState'>,
  options: PlayRouteEnterOptions = {},
): void {
  const { skipAnalytics = false } = options
  const midi = store.state.loadedMidi
  const status = store.state.status
  if (!midi) {
    if (status === 'loading') return
    store.enterPlayLanding()
    shell.renderer.clearMidi()
    shell.trackPanel.close()
    shell.dropzone.hide()
    shell.keyboardInput.enable()
    document.title = `midee - ${t('topStrip.mode.play.label')}`
    return
  }

  store.enterPlay(false)
  shell.renderer.loadMidi(midi)
  shell.trackPanel.render(midi)
  shell.dropzone.hide()
  shell.keyboardInput.enable()
  document.title = `${midi.name} - midee`
  if (!skipAnalytics) {
    const props = { duration_s: Math.round(midi.duration) }
    trackEvent('play_mode_entered', props)
    track('file_mode_entered', props)
  }
}

export function applyLiveRouteEntry(store: AppStore, shell: RouteEntryShell): void {
  shell.resetInteractionState()
  store.enterLive()
  shell.renderer.clearMidi()
  shell.trackPanel.close()
  shell.dropzone.hide()
  shell.keyboardInput.enable()
  document.title = t('doc.title.live')
}

export function syncLoadedMidiForCurrentRoute(shell: RouteSyncShell): void {
  shell.syncConsolePanel()
  if (!isPlayRouteTarget(shell.currentRouteTarget())) return
  shell.enterPlayRoute({ skipAnalytics: true })
}
