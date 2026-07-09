import type { AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import { applyLiveRouteEntry, applyPlayRouteEntry } from '@/app/runtime/routeEntry'
import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import { t } from '@/i18n'
import type {
  DisplayPrefsState,
  LearnRuntimeRegistryPort,
  MidiOpenTarget,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from '@/services/runtime/contracts'
import type {
  LearnEnterRequest,
  LibraryOpenRequest,
  PlayRouteEnterOptions,
} from '@/stores/app/AppCtx'
import type { AppStore } from '@/stores/app/state'
import { isLearnRouteTarget, isPlayRouteTarget } from '@/stores/routing/routeTarget'
import type { MidiFile } from '@/types/midi/types'

interface AppApplicationControllerOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  learnRuntimeRegistry: LearnRuntimeRegistryPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
  keyboardInput: { enable(): void }
  fileFlows: {
    openFilePicker(target?: MidiOpenTarget): void
    openSample(sampleId: string, target: MidiOpenTarget): Promise<void>
    openLocalMidi(id: string, target: MidiOpenTarget): Promise<void>
    enterLearn(request: LearnEnterRequest): Promise<void> | void
  }
  resetInteractionState(): void
  syncConsolePanel(): void
}

export class AppApplicationController implements AppIntentDriver {
  constructor(private readonly opts: AppApplicationControllerOptions) {}

  navigate(
    target: Parameters<RuntimeNavigationPort['navigate']>[0],
    options?: { replace?: boolean },
  ): void {
    this.opts.navigation.navigate(target, options)
  }

  enterPlayRoute(options: PlayRouteEnterOptions = {}): Promise<void> {
    return applyPlayRouteEntry(
      this.routeEntryStore(),
      {
        renderer: this.opts.services.renderer,
        playbackAudio: {
          load: (midi) => this.opts.services.synth.load(midi),
        },
        trackPanel: {
          close: () => this.opts.ui.closeTrackPanel(),
          render: (midi) => this.opts.ui.renderTrackPanel(midi),
        },
        dropzone: {
          show: () => this.opts.ui.showDropzone(),
          hide: () => this.opts.ui.hideDropzone(),
        },
        keyboardInput: this.opts.keyboardInput,
      },
      options,
    )
  }

  enterLiveRoute(): void {
    applyLiveRouteEntry(this.routeEntryStore(), {
      renderer: this.opts.services.renderer,
      playbackAudio: {
        load: (midi) => this.opts.services.synth.load(midi),
      },
      trackPanel: {
        close: () => this.opts.ui.closeTrackPanel(),
        render: (midi) => this.opts.ui.renderTrackPanel(midi),
      },
      dropzone: {
        show: () => this.opts.ui.showDropzone(),
        hide: () => this.opts.ui.hideDropzone(),
      },
      keyboardInput: this.opts.keyboardInput,
      resetInteractionState: () => this.opts.resetInteractionState(),
    })
  }

  openLibraryRequest(request: LibraryOpenRequest): Promise<void> | void {
    if (request.kind === 'picker') {
      this.opts.fileFlows.openFilePicker(request.target)
      return
    }
    if (!request.entry) return
    if (request.target === 'learn') {
      if (request.entry.kind === 'local') {
        return this.opts.fileFlows.enterLearn({ kind: 'local', id: request.entry.id })
      }
      return this.opts.fileFlows.enterLearn({ kind: 'sample', sampleId: request.entry.id })
    }
    if (request.entry.kind === 'local') {
      return this.opts.fileFlows.openLocalMidi(request.entry.id, request.target ?? 'play')
    }
    return this.opts.fileFlows.openSample(request.entry.id, request.target ?? 'play')
  }

  async enterLearnHub(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return
    this.enterLearnShell('hub')
  }

  exitLearnHub(): void {
    this.exitLearnShell()
  }

  async enterExerciseRoute(route: ExerciseRouteId, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return
    this.enterLearnShell(route)
  }

  exitExerciseRoute(): void {
    this.exitLearnShell()
  }

  enterLearnRequest(request: LearnEnterRequest): Promise<void> | void {
    return this.opts.fileFlows.enterLearn(request)
  }

  async openPreparedPlayAlong(midi: MidiFile): Promise<void> {
    const activeRuntime = this.opts.learnRuntimeRegistry.getActiveRuntime()
    const consumer = this.opts.learnRuntimeRegistry.getPreparedMidiConsumer()
    if (activeRuntime?.routeId === 'play-along' && consumer) {
      await consumer.loadPreparedMidi(midi)
      return
    }
    this.opts.learnRuntimeRegistry.stagePreparedPlayAlongMidi(midi)
    this.opts.navigation.navigate({ kind: 'exercise', routeId: 'play-along' })
  }

  resetInteractionState(): void {
    this.opts.resetInteractionState()
  }

  primeInteractiveAudio(): void {
    this.opts.services.primeInteractiveAudio()
  }

  private enterLearnShell(target: 'hub' | ExerciseRouteId): void {
    this.opts.resetInteractionState()
    this.opts.ui.closeTransientOverlays()
    this.opts.ui.closeConsole()
    this.opts.services.clock.pause()
    this.opts.services.clock.seek(0)
    this.opts.services.synth.resetTransport()
    this.opts.services.renderer.clearMidi()
    this.opts.services.renderer.setLiveNotesVisible(false)
    this.opts.ui.closeTrackPanel()
    this.opts.ui.hideDropzone()
    this.opts.keyboardInput.enable()
    this.opts.ui.setLearnFileName(null)
    this.opts.services.renderer.setVisible(target !== 'hub' && target !== 'play-along')
    document.title = t('doc.title.learn')
    this.opts.syncConsolePanel()
  }

  private exitLearnShell(): void {
    this.opts.services.renderer.setVisible(true)
    this.opts.services.renderer.setLiveNotesVisible(true)
    this.opts.syncConsolePanel()
    const store = this.routeEntryStore()
    if (isPlayRouteTarget(this.opts.navigation.getCurrentTarget()) && store.state.loadedMidi) {
      void this.opts.services.synth.load(store.state.loadedMidi).catch((err) => {
        console.error('[exitLearnShell] Failed to restore audio:', err)
      })
    }
  }

  currentOpenTarget(explicit?: MidiOpenTarget): MidiOpenTarget {
    if (explicit) return explicit
    return isLearnRouteTarget(this.opts.navigation.getCurrentTarget()) ? 'learn' : 'play'
  }

  private routeEntryStore(): AppStore {
    return this.opts.playbackSession as unknown as AppStore
  }
}
