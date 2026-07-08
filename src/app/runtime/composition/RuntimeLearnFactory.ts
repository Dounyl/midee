import type { RuntimeDependencies } from './RuntimeDependencies'
import type { RuntimeState } from './RuntimeState'
import type { RuntimeLifecycle } from './RuntimeLifecycle'
import { createPlayAlongRuntime, createExerciseRuntime } from '../learnRuntimeFactories'
import type { PlayAlongPageRuntime } from '@/features/learn/runtime/PlayAlongPageRuntime'
import type { ExercisePageRuntime } from '@/features/learn/runtime/ExercisePageRuntime'
import type { CreateExercisePageRuntimeOptions } from '@/features/learn/runtime/types'
import type { AppServices } from '@/types/app/AppServices'

/**
 * RuntimeLearnFactory
 *
 * 创建 Learn page runtimes。
 * 职责：
 * - 创建 PlayAlongPageRuntime
 * - 创建 ExercisePageRuntime（intervals, sight-reading 等）
 * - 连接 lifecycle 回调（activate/deactivate）
 * - 提供统一的 services 配置
 */
export class RuntimeLearnFactory {
  constructor(
    private readonly deps: RuntimeDependencies,
    private readonly state: RuntimeState,
    private readonly lifecycle: RuntimeLifecycle,
    private readonly overlay: HTMLElement,
    private readonly getLearnRuntimeLifecycle: () => {
      activate: (runtime: any) => void
      deactivate: (runtime: any) => void
    },
  ) {}

  /**
   * 创建 PlayAlongPageRuntime
   */
  createPlayAlongPageRuntime(): PlayAlongPageRuntime {
    this.lifecycle.assertReady('createPlayAlongPageRuntime')

    const services: AppServices = {
      store: this.deps.store,
      clock: this.deps.clock,
      synth: this.deps.synth,
      metronome: this.deps.metronome,
      renderer: this.deps.renderer,
      input: this.deps.inputBus,
    }

    return createPlayAlongRuntime({
      services,
      overlayRoot: this.overlay,
      keyboardMode: this.deps.keyboardModeCoordinator,
      setLearnFileName: (name) => this.deps.ui.setLearnFileName(name),
      updateConsolePanel: () => this.deps.exportOverlay?.syncConsolePanel(),
      lifecycle: {
        onActivate: (runtime) => this.getLearnRuntimeLifecycle().activate(runtime),
        onDeactivate: (runtime) => this.getLearnRuntimeLifecycle().deactivate(runtime),
      },
      consumePendingMidi: () => this.deps.learnRuntimeRegistry.consumePreparedPlayAlongMidi(),
    })
  }

  /**
   * 创建 ExercisePageRuntime
   */
  createExercisePageRuntime(options: CreateExercisePageRuntimeOptions): ExercisePageRuntime {
    this.lifecycle.assertReady('createExercisePageRuntime')

    const services: AppServices = {
      store: this.deps.store,
      clock: this.deps.clock,
      synth: this.deps.synth,
      metronome: this.deps.metronome,
      renderer: this.deps.renderer,
      input: this.deps.inputBus,
    }

    return createExerciseRuntime({
      services,
      overlayRoot: this.overlay,
      page: options,
      lifecycle: {
        onActivate: (runtime) => this.getLearnRuntimeLifecycle().activate(runtime),
        onDeactivate: (runtime) => this.getLearnRuntimeLifecycle().deactivate(runtime),
      },
    })
  }
}
