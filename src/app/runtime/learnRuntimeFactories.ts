import { ExercisePageRuntime } from '@/features/learn/runtime/ExercisePageRuntime'
import { PlayAlongPageRuntime } from '@/features/learn/runtime/PlayAlongPageRuntime'
import type {
  CreateExercisePageRuntimeOptions,
  LearnRuntimeHandle,
} from '@/features/learn/runtime/types'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'

export interface LearnRuntimeLifecycleHooks {
  onActivate(runtime: LearnRuntimeHandle): void
  onDeactivate(runtime: LearnRuntimeHandle): void
}

export interface CreatePlayAlongPageRuntimeOptions {
  services: AppServices
  overlayRoot: HTMLElement
  keyboardMode: KeyboardModeCoordinator
  setLearnFileName(name: string | null): void
  updateConsolePanel(): void
  lifecycle: LearnRuntimeLifecycleHooks
  consumePendingMidi(): MidiFile | null
}

export function createPlayAlongRuntime(
  options: CreatePlayAlongPageRuntimeOptions,
): PlayAlongPageRuntime {
  return new PlayAlongPageRuntime({
    services: options.services,
    overlayRoot: options.overlayRoot,
    keyboardMode: options.keyboardMode,
    setLearnFileName: options.setLearnFileName,
    updateConsolePanel: options.updateConsolePanel,
    onActivate: options.lifecycle.onActivate,
    onDeactivate: options.lifecycle.onDeactivate,
    consumePendingMidi: options.consumePendingMidi,
  })
}

export interface CreateExerciseRuntimeOptions {
  services: AppServices
  overlayRoot: HTMLElement
  page: CreateExercisePageRuntimeOptions
  lifecycle: LearnRuntimeLifecycleHooks
}

export function createExerciseRuntime(options: CreateExerciseRuntimeOptions): ExercisePageRuntime {
  return new ExercisePageRuntime({
    services: options.services,
    overlayRoot: options.overlayRoot,
    routeId: options.page.routeId,
    descriptor: options.page.descriptor,
    onNext: options.page.onNext,
    onActivate: options.lifecycle.onActivate,
    onDeactivate: options.lifecycle.onDeactivate,
  })
}
