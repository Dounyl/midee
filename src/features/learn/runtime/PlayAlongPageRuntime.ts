import { cssModuleClass } from '@/components/common/utils'
import type { ExerciseDescriptor } from '@/features/learn/core/Exercise'
import { ExerciseRunner } from '@/features/learn/core/ExerciseRunner'
import {
  createLearnState,
  type LearnState,
  type LearnStatus,
} from '@/features/learn/core/LearnState'
import { createLearnProgressStore, type LearnProgressStore } from '@/features/learn/core/progress'
import { playAlongDescriptor } from '@/features/learn/exercises/play-along'
import { findExercise } from '@/features/learn/hub/registry'
import { LearnOverlay } from '@/features/learn/overlays/LearnOverlay'
import learnHostStyles from '@/features/learn/ui/LearnHost.module.css'
import { createSessionSummary } from '@/features/learn/ui/SessionSummary'
import { track } from '@/features/telemetry'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import { createEventSignal } from '@/stores/app/eventSignal'
import { watch } from '@/stores/app/watch'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'
import { PlayAlongSessionManager } from './PlayAlongSessionManager'
import type { LearnConsoleState, LearnRuntimeHandle, PlayAlongPageRuntimeHandle } from './types'

export interface PlayAlongPageRuntimeDeps {
  services: AppServices
  overlayRoot: HTMLElement
  keyboardMode: KeyboardModeCoordinator
  setLearnFileName: (name: string | null) => void
  updateConsolePanel: () => void
  onActivate: (runtime: LearnRuntimeHandle) => void
  onDeactivate: (runtime: LearnRuntimeHandle) => void
  consumePendingMidi: () => MidiFile | null
}

export class PlayAlongPageRuntime implements PlayAlongPageRuntimeHandle {
  readonly routeId = 'play-along' as const
  readonly learnState: LearnState = createLearnState()
  readonly view = createEventSignal<'page' | 'exercise'>('page')
  private readonly progress: LearnProgressStore = createLearnProgressStore()

  private runner: ExerciseRunner | null = null
  private overlay: LearnOverlay | null = null
  private exerciseHost: HTMLElement | null = null
  private summaryHost: HTMLElement | null = null
  private summaryAutoHide: ReturnType<typeof setTimeout> | null = null
  private unsubs: Array<() => void> = []
  private firstPlayLogged = false
  private readonly session: PlayAlongSessionManager

  constructor(private readonly deps: PlayAlongPageRuntimeDeps) {
    this.session = new PlayAlongSessionManager({
      services: deps.services,
      learnState: this.learnState,
      keyboardMode: deps.keyboardMode,
      setLearnFileName: deps.setLearnFileName,
      updateConsolePanel: deps.updateConsolePanel,
      onMidiReady: async () => {
        if (this.runner?.isActive) this.runner.close('abandoned')
        this.hideSummaryHost()
        await this.launchExercise(playAlongDescriptor)
      },
    })
  }

  enter(): void {
    if (this.exerciseHost && this.summaryHost && this.overlay) return

    this.mountHostElements(this.deps.overlayRoot)
    this.overlay = new LearnOverlay()
    this.deps.services.renderer.addLayer(this.overlay)
    this.deps.services.renderer.setVisible(false)

    this.session.clearSession()
    this.progress.touchStreak()
    this.firstPlayLogged = false
    this.unsubs.push(
      watch(
        () => this.learnState.state.status,
        (status) => this.onStatusChange(status),
      ),
    )
    this.deps.onActivate(this)
    this.deps.updateConsolePanel()

    const pendingMidi = this.deps.consumePendingMidi()
    if (pendingMidi) void this.session.loadPreparedMidi(pendingMidi)
  }

  async loadPreparedMidi(midi: MidiFile): Promise<void> {
    if (!this.exerciseHost || !this.overlay) this.enter()
    await this.session.loadPreparedMidi(midi)
  }

  async startPlayAlong(): Promise<void> {
    if (!this.learnState.state.loadedMidi || this.runner?.isActive) return
    this.hideSummaryHost()
    await this.launchExercise(playAlongDescriptor)
  }

  exit(): void {
    if (this.runner?.isActive) this.runner.close('abandoned')
    for (const off of this.unsubs) off()
    this.unsubs = []
    if (this.summaryAutoHide) clearTimeout(this.summaryAutoHide)
    this.summaryAutoHide = null
    this.unmountHostElements()
    if (this.overlay) {
      this.deps.services.renderer.removeLayer(this.overlay)
      this.overlay = null
    }
    this.session.clearSession()
    this.runner = null
    this.view.set('page')
    this.deps.onDeactivate(this)
  }

  getConsoleState(): LearnConsoleState {
    return {
      enabled: this.session.isTransposeEnabled(),
      baseKey: this.session.baseKey,
      current: this.session.currentTranspose,
    }
  }

  setTranspose(semitones: number): void {
    if (!this.session.isTransposeEnabled()) return
    this.session.setTranspose(semitones, this.learnState.state.status, (midi) => {
      this.runner?.replaceMidi(midi)
    })
  }

  getLoadedMidi(): MidiFile | null {
    return this.learnState.state.loadedMidi
  }

  private closeActiveExercise(reason: 'completed' | 'abandoned' = 'abandoned'): void {
    if (!this.runner?.isActive) return

    const lastDescriptor = this.runner.activeId
    const lastMidi = this.learnState.state.loadedMidi
    const xpBefore = this.progress.xp
    const streakBefore = this.progress.streakDays
    const result = this.runner.close(reason)

    this.deps.services.renderer.clearMidi()
    this.deps.services.renderer.setVisible(false)
    this.session.clearSession()
    this.view.set('page')

    if (result && lastDescriptor && this.summaryHost) {
      this.summaryHost.classList.remove(learnHostStyles.learnHostHidden!)
      const summary = createSessionSummary({
        onAgain: () => {
          summary.dismiss()
          this.hideSummaryHost()
          if (lastMidi && lastDescriptor === playAlongDescriptor.id) {
            void this.session.loadPreparedMidi(lastMidi)
          } else {
            this.relaunchById(lastDescriptor)
          }
        },
        onNext: () => {
          summary.dismiss()
          this.hideSummaryHost()
        },
      })
      summary.show(this.summaryHost, result, {
        streakExtended: this.progress.streakDays > streakBefore,
        xpGained: Math.max(0, this.progress.xp - xpBefore),
      })
      this.summaryAutoHide = setTimeout(() => {
        this.summaryAutoHide = null
        this.hideSummaryHost()
      }, 4100)
    }
  }

  private async launchExercise(descriptor: ExerciseDescriptor): Promise<void> {
    if (!this.exerciseHost || !this.overlay) return
    this.hideSummaryHost()
    this.view.set('exercise')
    this.deps.services.renderer.setVisible(true)
    if (!this.runner) {
      this.runner = new ExerciseRunner({
        services: this.deps.services,
        learnState: this.learnState,
        progress: this.progress,
        overlay: this.overlay,
        host: this.exerciseHost,
        onClose: (reason) => this.closeActiveExercise(reason),
      })
    }
    await this.runner.launch(descriptor)
  }

  private relaunchById(id: string): void {
    const descriptor = findExercise(id)
    if (descriptor) void this.launchExercise(descriptor)
  }

  private onStatusChange(status: LearnStatus): void {
    const { synth, clock } = this.deps.services
    if (status === 'playing') {
      void synth.play(clock.currentTime)
      if (!this.firstPlayLogged) {
        this.firstPlayLogged = true
        const midi = this.learnState.state.loadedMidi
        track('first_play', {
          mode: 'learn',
          duration_s: midi ? Math.round(midi.duration) : null,
        })
      }
    } else if (status === 'paused') {
      synth.pause()
    }
    this.deps.updateConsolePanel()
  }

  private mountHostElements(overlay: HTMLElement): void {
    if (this.exerciseHost && this.summaryHost) return
    const exercise = document.createElement('div')
    exercise.className = cssModuleClass(learnHostStyles, 'learnHost', 'learnHostExercise')
    const summary = document.createElement('div')
    summary.className = cssModuleClass(
      learnHostStyles,
      'learnHost',
      'learnHostHub',
      'learnHostHidden',
    )
    overlay.appendChild(summary)
    overlay.appendChild(exercise)
    this.summaryHost = summary
    this.exerciseHost = exercise
  }

  private unmountHostElements(): void {
    this.summaryHost?.remove()
    this.exerciseHost?.remove()
    this.summaryHost = null
    this.exerciseHost = null
  }

  private hideSummaryHost(): void {
    this.summaryHost?.classList.add(learnHostStyles.learnHostHidden!)
  }
}
