import type { MidiFile, MidiKeySignature } from '../core/midi/types'
import type { ExerciseDescriptor } from '../learn/core/Exercise'
import { ExerciseRunner } from '../learn/core/ExerciseRunner'
import { createLearnState, type LearnState, type LearnStatus } from '../learn/core/LearnState'
import { createLearnProgressStore, type LearnProgressStore } from '../learn/core/progress'
import { playAlongDescriptor } from '../learn/exercises/play-along'
import { findExercise } from '../learn/hub/registry'
import { LearnOverlay } from '../learn/overlays/LearnOverlay'
import learnHostStyles from '@/features/learn/ui/LearnHost.module.css'
import { createSessionSummary } from '../learn/ui/SessionSummary'
import { getCurrentRouteMode } from '../routing/routerBridge'
import { createEventSignal } from '../store/eventSignal'
import { watch } from '../store/watch'
import { track, trackEvent } from '../telemetry'
import { showError } from '../ui/Toast'
import { cssModuleClass } from '../ui/utils'
import { LearnSessionManager } from './LearnSessionManager'
import type { ModeContext } from './ModeController'

export class LearnController {
  readonly learnState: LearnState = createLearnState()
  private readonly progress: LearnProgressStore = createLearnProgressStore()

  private runner: ExerciseRunner | null = null
  private overlay: LearnOverlay | null = null
  readonly view = createEventSignal<'page' | 'exercise'>('page')
  private exerciseHost: HTMLElement | null = null
  private summaryHost: HTMLElement | null = null
  private summaryAutoHide: ReturnType<typeof setTimeout> | null = null
  private unsubs: Array<() => void> = []
  private firstPlayLogged = false
  private pendingMidi: MidiFile | null = null
  private readonly session: LearnSessionManager

  constructor(private ctx: ModeContext) {
    this.session = new LearnSessionManager({
      ctx: this.ctx,
      learnState: this.learnState,
      onMidiReady: async () => {
        if (this.runner?.isActive) this.runner.close('abandoned')
        this.hideSummaryHost()
        await this.launchExercise(playAlongDescriptor)
      },
      onError: (msg) => this.showError(msg),
    })
  }

  enter(): void {
    if (this.exerciseHost && this.summaryHost && this.overlay) return

    const from = getCurrentRouteMode() ?? 'home'
    const wasAlreadyLearn = from === 'learn'

    this.mountHostElements(this.ctx.overlay)
    this.overlay = new LearnOverlay()
    this.ctx.services.renderer.addLayer(this.overlay)
    this.ctx.services.renderer.setVisible(false)

    this.session.clearSession()
    this.progress.touchStreak()
    this.firstPlayLogged = false
    this.unsubs.push(
      watch(
        () => this.learnState.state.status,
        (status) => this.onStatusChange(status),
      ),
    )
    this.ctx.updateConsolePanel()

    if (!wasAlreadyLearn) trackEvent('learn_mode_entered', { from })

    if (this.pendingMidi) {
      const midi = this.pendingMidi
      this.pendingMidi = null
      void this.session.loadPreparedMidi(midi)
    }
  }

  queueMidi(midi: MidiFile): void {
    this.pendingMidi = midi
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
      this.ctx.services.renderer.removeLayer(this.overlay)
      this.overlay = null
    }
    this.session.clearSession()
    this.runner = null
    this.view.set('page')
  }

  getConsoleState(): {
    enabled: boolean
    baseKey: MidiKeySignature | null
    current: number
  } {
    return {
      enabled: this.session.isTransposeEnabled(),
      baseKey: this.session.baseKey as MidiKeySignature | null,
      current: this.session.currentTranspose,
    }
  }

  setTranspose(semitones: number): void {
    if (!this.session.isTransposeEnabled()) return
    this.session.setTranspose(semitones, this.learnState.state.status, (midi) => {
      this.runner?.replaceMidi(midi)
    })
  }

  async loadMidiFromFile(file: File, source: 'drag' | 'picker' = 'picker'): Promise<void> {
    if (!this.exerciseHost || !this.overlay) this.enter()
    await this.session.loadMidiFromFile(file, source)
  }

  async loadSample(sampleId: string): Promise<void> {
    if (!this.exerciseHost || !this.overlay) this.enter()
    await this.session.loadSample(sampleId)
  }

  closeActiveExercise(reason: 'completed' | 'abandoned' = 'abandoned'): void {
    if (!this.runner?.isActive) return

    const lastDescriptor = this.runner.activeId
    const lastMidi = this.learnState.state.loadedMidi
    const xpBefore = this.progress.xp
    const streakBefore = this.progress.streakDays
    const result = this.runner.close(reason)

    this.ctx.services.renderer.clearMidi()
    this.ctx.services.renderer.setVisible(false)
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
    this.ctx.services.renderer.setVisible(true)
    if (!this.runner) {
      this.runner = new ExerciseRunner({
        services: this.ctx.services,
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
    const { synth, clock } = this.ctx.services
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
    this.ctx.updateConsolePanel()
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
    this.exerciseHost = exercise
    this.summaryHost = summary
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

  private showError(msg: string): void {
    showError(msg)
  }
}
