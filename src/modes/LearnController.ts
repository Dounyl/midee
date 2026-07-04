import type { MidiFile, MidiKeySignature } from '../core/midi/types'
import { t } from '../i18n'
import type { ExerciseDescriptor } from '../learn/core/Exercise'
import { ExerciseRunner } from '../learn/core/ExerciseRunner'
import { createLearnState, type LearnState, type LearnStatus } from '../learn/core/LearnState'
import { createLearnProgressStore, type LearnProgressStore } from '../learn/core/progress'
import { playAlongDescriptor } from '../learn/exercises/play-along'
import { findExercise } from '../learn/hub/catalog'
import { createLearnHub, type LearnHubOptions } from '../learn/hub/LearnHub'
import { LearnOverlay } from '../learn/overlays/LearnOverlay'
import { createSessionSummary } from '../learn/ui/SessionSummary'
import { createEventSignal } from '../store/eventSignal'
import { watch } from '../store/watch'
import { track, trackEvent } from '../telemetry'
import { LearnSessionManager } from './LearnSessionManager'
import type { ModeContext } from './ModeController'

export class LearnController {
  readonly learnState: LearnState = createLearnState()
  private readonly progress: LearnProgressStore = createLearnProgressStore()

  private hub: ReturnType<typeof createLearnHub>
  private readonly hubOpts: LearnHubOptions
  private runner: ExerciseRunner | null = null
  private overlay: LearnOverlay | null = null
  readonly view = createEventSignal<'hub' | 'exercise'>('hub')
  private hubHost: HTMLElement | null = null
  private exerciseHost: HTMLElement | null = null
  private unsubs: Array<() => void> = []
  private firstPlayLogged = false
  private pendingMidi: MidiFile | null = null
  private readonly session: LearnSessionManager

  constructor(private ctx: ModeContext) {
    this.hub = createLearnHub()
    this.hubOpts = {
      progress: this.progress,
      learnState: this.learnState,
      launchExercise: (descriptor) => void this.launchExercise(descriptor),
      onOpenFilePicker: () => this.openLearnFilePicker(),
      onOpenLocalMidi: (id) => this.ctx.openLocalMidi(id, 'learn'),
    }
    this.session = new LearnSessionManager({
      ctx: this.ctx,
      learnState: this.learnState,
      onMidiReady: async () => {
        if (this.runner?.isActive) this.runner.close('abandoned')
        await this.launchExercise(playAlongDescriptor)
      },
      onError: (msg) => this.showError(msg),
    })
  }

  enter(): void {
    const { services, trackPanel, dropzone, keyboardInput, resetInteractionState, overlay } =
      this.ctx
    const from = services.store.state.mode
    const wasAlreadyLearn = from === 'learn'
    resetInteractionState()
    services.clock.pause()
    services.clock.seek(0)
    services.store.setState('mode', 'learn')
    services.renderer.clearMidi()
    services.renderer.setLiveNotesVisible(false)
    trackPanel.close()
    dropzone.hide()
    keyboardInput.enable()
    document.title = t('doc.title.learn')

    this.mountHostElements(overlay)
    this.showHubView()
    this.hub.mount(this.hubHost!, this.hubOpts)
    this.overlay = new LearnOverlay()
    services.renderer.addLayer(this.overlay)

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
    await this.session.loadPreparedMidi(midi)
  }

  exit(): void {
    if (this.runner?.isActive) this.runner.close('abandoned')
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.hub.unmount()
    this.unmountHostElements()
    this.ctx.services.renderer.setVisible(true)
    if (this.overlay) {
      this.ctx.services.renderer.removeLayer(this.overlay)
      this.overlay = null
    }
    this.ctx.services.renderer.setLiveNotesVisible(true)
    this.session.clearSession()
    this.runner = null
    this.view.set('hub')
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
    await this.session.loadMidiFromFile(file, source)
  }

  async loadSample(sampleId: string): Promise<void> {
    await this.session.loadSample(sampleId)
  }

  private async launchExercise(descriptor: ExerciseDescriptor): Promise<void> {
    if (!this.exerciseHost || !this.overlay) return
    this.showExerciseView()
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

  closeActiveExercise(reason: 'completed' | 'abandoned' = 'abandoned'): void {
    if (!this.runner?.isActive) return
    const lastDescriptor = this.runner.activeId
    const lastMidi = this.learnState.state.loadedMidi
    const xpBefore = this.progress.xp
    const streakBefore = this.progress.streakDays
    const result = this.runner.close(reason)
    this.showHubView()
    this.session.clearSession()
    if (result && lastDescriptor) {
      const summary = createSessionSummary({
        onAgain: () => {
          if (lastMidi && lastDescriptor === playAlongDescriptor.id) {
            void this.session.loadPreparedMidi(lastMidi)
          } else {
            this.relaunchById(lastDescriptor)
          }
        },
        onNext: () => {},
      })
      const host = this.hubHost
      if (host) {
        summary.show(host, result, {
          streakExtended: this.progress.streakDays > streakBefore,
          xpGained: Math.max(0, this.progress.xp - xpBefore),
        })
      }
    }
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
    if (this.hubHost && this.exerciseHost) return
    const hub = document.createElement('div')
    hub.className = 'learn-host learn-host--hub'
    const ex = document.createElement('div')
    ex.className = 'learn-host learn-host--exercise'
    overlay.appendChild(hub)
    overlay.appendChild(ex)
    this.hubHost = hub
    this.exerciseHost = ex
  }

  private unmountHostElements(): void {
    this.hubHost?.remove()
    this.exerciseHost?.remove()
    this.hubHost = null
    this.exerciseHost = null
  }

  private showHubView(): void {
    if (!this.hubHost || !this.exerciseHost) return
    this.hubHost.classList.remove('learn-host--hidden')
    this.exerciseHost.classList.add('learn-host--hidden')
    this.view.set('hub')
    this.ctx.services.renderer.clearMidi()
    this.ctx.services.renderer.setVisible(false)
  }

  private showExerciseView(): void {
    if (!this.hubHost || !this.exerciseHost) return
    this.hubHost.classList.add('learn-host--hidden')
    this.exerciseHost.classList.remove('learn-host--hidden')
    this.view.set('exercise')
    this.ctx.services.renderer.setVisible(true)
  }

  private openLearnFilePicker(): void {
    this.ctx.openFilePicker('learn')
  }

  private showError(msg: string): void {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }
}
