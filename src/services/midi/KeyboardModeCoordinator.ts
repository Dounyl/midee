import { type KeyboardMode, shouldPromptKeyboardModeSuggestion } from '@/lib/core/keyboardLayout'
import type { MidiFile } from '@/types/midi/types'

interface KeyboardModeCoordinatorOptions {
  initialMode: KeyboardMode
  persistMode: (mode: KeyboardMode) => void
  applyMode: (mode: KeyboardMode) => void
  syncConsolePanel: () => void
}

interface KeyboardModeResolutionHandlers {
  onTranspose: (semitones: number) => void | Promise<void>
  onSwitchTo88?: () => void | Promise<void>
}

export class KeyboardModeCoordinator {
  private mode: KeyboardMode

  constructor(private readonly opts: KeyboardModeCoordinatorOptions) {
    this.mode = opts.initialMode
  }

  getMode(): KeyboardMode {
    return this.mode
  }

  setMode(mode: KeyboardMode): void {
    if (mode === this.mode) return
    this.mode = mode
    this.opts.persistMode(mode)
    this.opts.applyMode(mode)
    this.opts.syncConsolePanel()
  }

  requestModeChange(
    nextMode: KeyboardMode,
    activeMidi: MidiFile | null,
    handlers: KeyboardModeResolutionHandlers,
  ): void {
    if (nextMode === this.mode) return
    if (nextMode === '61' && activeMidi && shouldPromptKeyboardModeSuggestion(activeMidi, '61')) {
      void handlers.onSwitchTo88?.()
      return
    }
    this.setMode(nextMode)
  }

  ensureMidiFitsCurrentMode(
    midi: MidiFile,
    _sourceMidi: MidiFile,
    handlers: KeyboardModeResolutionHandlers,
  ): boolean {
    if (!shouldPromptKeyboardModeSuggestion(midi, this.mode)) return true
    this.setMode('88')
    void handlers.onSwitchTo88?.()
    return false
  }
}
