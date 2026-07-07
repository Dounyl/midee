import { ConsolePanel } from '@/components/playback/ConsolePanel'
import type { KeyboardMode } from '@/lib/core/keyboardLayout'
import { transposeDeltaToTonic } from '@/lib/music/KeySignature'
import type { KeyboardModeCoordinator } from '@/services/midi/KeyboardModeCoordinator'
import type { MidiFile, MidiKeySignature } from '@/types/midi/types'

export interface ResolveConsoleKeyContext {
  learnBaseKey: MidiKeySignature | null
  playBaseKey: MidiKeySignature | null
}

export function resolveConsoleResetTranspose(context: ResolveConsoleKeyContext): number {
  return transposeDeltaToTonic(context.learnBaseKey ?? context.playBaseKey, 'C')
}

export interface RequestConsoleKeyboardModeChangeOptions {
  mode: KeyboardMode
  coordinator: KeyboardModeCoordinator
  activeMidi: MidiFile | null
  onTranspose(semitones: number): void
}

export function requestConsoleKeyboardModeChange(
  options: RequestConsoleKeyboardModeChangeOptions,
): void {
  options.coordinator.requestModeChange(options.mode, options.activeMidi, {
    onTranspose: options.onTranspose,
  })
}

export interface CreateConsolePanelOptions {
  container: HTMLElement
  onChange(value: number): void
  onResetToC(): void
  onKeyboardModeChange(mode: KeyboardMode): void
  onToggleLabels(visible: boolean): void
}

export function createConsolePanel(options: CreateConsolePanelOptions): ConsolePanel {
  return new ConsolePanel(
    options.container,
    options.onChange,
    options.onResetToC,
    options.onKeyboardModeChange,
    options.onToggleLabels,
  )
}
