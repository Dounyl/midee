import { cssModuleClass } from '@/components/common/utils'
import type { ExerciseDescriptor } from '@/features/learn/core/Exercise'
import { ExerciseRunner } from '@/features/learn/core/ExerciseRunner'
import { createLearnState } from '@/features/learn/core/LearnState'
import { createLearnProgressStore } from '@/features/learn/core/progress'
import { LearnOverlay } from '@/features/learn/overlays/LearnOverlay'
import learnHostStyles from '@/features/learn/ui/LearnHost.module.css'
import { createSessionSummary } from '@/features/learn/ui/SessionSummary'
import type { ExerciseRouteId } from '@/features/routing/learnRoutes'
import { assertDefined } from '@/lib/assert'
import type { AppServices } from '@/types/app/AppServices'
import type { ExercisePageRuntimeHandle, LearnRuntimeHandle } from './types'

export interface ExercisePageRuntimeDeps {
  services: AppServices
  overlayRoot: HTMLElement
  routeId: ExerciseRouteId
  descriptor: ExerciseDescriptor
  onNext: () => void
  onActivate: (runtime: LearnRuntimeHandle) => void
  onDeactivate: (runtime: LearnRuntimeHandle) => void
}

export class ExercisePageRuntime implements ExercisePageRuntimeHandle {
  private readonly learnState = createLearnState()
  private readonly progress = createLearnProgressStore()
  private overlay: LearnOverlay | null = null
  private runner: ExerciseRunner | null = null
  private host: HTMLElement | null = null
  private summaryHost: HTMLElement | null = null
  private summaryAutoHide: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly deps: ExercisePageRuntimeDeps) {}

  get routeId(): ExerciseRouteId {
    return this.deps.routeId
  }

  async enter(): Promise<void> {
    const overlayRoot = assertDefined(
      this.deps.overlayRoot,
      'ExercisePageRuntime requires an overlay host before enter()',
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
    this.deps.services.renderer.addLayer(this.overlay)
    this.deps.services.renderer.setVisible(true)
    this.runner = new ExerciseRunner({
      services: this.deps.services,
      learnState: this.learnState,
      progress: this.progress,
      overlay: this.overlay,
      host: this.host,
      onClose: (reason) => this.closeActiveExercise(reason),
    })
    this.deps.onActivate(this)
    await this.runner.launch(this.deps.descriptor)
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
      this.deps.services.renderer.removeLayer(this.overlay)
      this.overlay = null
    }
    this.runner = null
    this.deps.onDeactivate(this)
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
        void this.runner?.launch(this.deps.descriptor)
      },
      onNext: () => {
        summary.dismiss()
        this.hideSummaryHost()
        this.deps.onNext()
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
