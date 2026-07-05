import { assertDefined } from '@/app/runtime/assert'
import learnHostStyles from '@/features/learn/ui/LearnHost.module.css'
import type { AppServices } from '../../core/services'
import type { ExerciseDescriptor } from '../../learn/core/Exercise'
import { ExerciseRunner } from '../../learn/core/ExerciseRunner'
import { createLearnState } from '../../learn/core/LearnState'
import { createLearnProgressStore } from '../../learn/core/progress'
import { LearnOverlay } from '../../learn/overlays/LearnOverlay'
import { createSessionSummary } from '../../learn/ui/SessionSummary'
import { cssModuleClass } from '../../ui/utils'

export class RoutedExerciseRuntime {
  private readonly learnState = createLearnState()
  private readonly progress = createLearnProgressStore()
  private overlay: LearnOverlay | null = null
  private runner: ExerciseRunner | null = null
  private host: HTMLElement | null = null
  private summaryHost: HTMLElement | null = null
  private summaryAutoHide: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly services: AppServices,
    private readonly overlayRoot: HTMLElement,
    private readonly descriptor: ExerciseDescriptor,
    private readonly onNext: () => void,
  ) {}

  async enter(): Promise<void> {
    const overlayRoot = assertDefined(
      this.overlayRoot,
      'RoutedExerciseRuntime requires an overlay host before enter()',
    )
    this.host = document.createElement('div')
    this.host.className = cssModuleClass(learnHostStyles, 'learnHost', 'learnHostExercise')
    overlayRoot.appendChild(this.host)

    this.summaryHost = document.createElement('div')
    this.summaryHost.className = cssModuleClass(
      learnHostStyles,
      'learnHost',
      'learnHostHub',
      'learnHostHidden',
    )
    overlayRoot.appendChild(this.summaryHost)

    this.overlay = new LearnOverlay()
    this.services.renderer.addLayer(this.overlay)
    this.services.renderer.setVisible(true)
    this.runner = new ExerciseRunner({
      services: this.services,
      learnState: this.learnState,
      progress: this.progress,
      overlay: this.overlay,
      host: this.host,
      onClose: (reason) => this.closeActiveExercise(reason),
    })
    await this.runner.launch(this.descriptor)
  }

  exit(): void {
    if (this.runner?.isActive) this.runner.close('abandoned')
    if (this.summaryAutoHide) clearTimeout(this.summaryAutoHide)
    this.summaryAutoHide = null
    this.summaryHost?.remove()
    this.host?.remove()
    this.summaryHost = null
    this.host = null
    if (this.overlay) {
      this.services.renderer.removeLayer(this.overlay)
      this.overlay = null
    }
    this.runner = null
  }

  private closeActiveExercise(reason: 'completed' | 'abandoned'): void {
    if (!this.runner?.isActive) return
    const xpBefore = this.progress.xp
    const streakBefore = this.progress.streakDays
    const result = this.runner.close(reason)
    if (!result || !this.summaryHost) return
    this.summaryHost.classList.remove(learnHostStyles.learnHostHidden!)
    const summary = createSessionSummary({
      onAgain: () => {
        summary.dismiss()
        this.hideSummaryHost()
        void this.runner?.launch(this.descriptor)
      },
      onNext: () => {
        summary.dismiss()
        this.hideSummaryHost()
        this.onNext()
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

  private hideSummaryHost(): void {
    this.summaryHost?.classList.add(learnHostStyles.learnHostHidden!)
  }
}
