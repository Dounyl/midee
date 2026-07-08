import {
  getCompatibleTranspositions,
  type KeyboardMode,
  type KeyboardTransposeSuggestion,
  shouldPromptKeyboardModeSuggestion,
} from '@/lib/core/keyboardLayout'
import type { MidiFile } from '@/types/midi/types'

interface KeyboardModeCoordinatorOptions {
  initialMode: KeyboardMode
  persistMode: (mode: KeyboardMode) => void
  applyMode: (mode: KeyboardMode) => void
  syncConsolePanel: () => void
  promptSuggestion: (request: KeyboardModeSuggestionRequest) => void
}

interface KeyboardModeResolutionHandlers {
  onTranspose: (semitones: number) => void | Promise<void>
  onSwitchTo88?: () => void | Promise<void>
}

export interface KeyboardModeSuggestionRequest {
  options: readonly KeyboardTransposeSuggestion[]
  onTranspose: (semitones: number) => void | Promise<void>
  onSwitchTo88: () => void | Promise<void>
  onClose?: () => void | Promise<void>
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
    currentTranspose = 0,
  ): void {
    if (nextMode === this.mode) return
    if (nextMode === '61' && activeMidi && shouldPromptKeyboardModeSuggestion(activeMidi, '61')) {
      this.promptSuggestion(activeMidi, currentTranspose, {
        onTranspose: (semitones) => {
          this.setMode('61')
          return handlers.onTranspose(semitones)
        },
        onSwitchTo88: () => handlers.onSwitchTo88?.(),
      })
      return
    }
    this.setMode(nextMode)
  }

  ensureMidiFitsCurrentMode(
    midi: MidiFile,
    sourceMidi: MidiFile,
    handlers: KeyboardModeResolutionHandlers,
  ): boolean {
    if (!shouldPromptKeyboardModeSuggestion(midi, this.mode)) return true
    this.promptSuggestion(sourceMidi, 0, {
      onTranspose: (semitones) => handlers.onTranspose(semitones),
      onSwitchTo88: () => {
        this.setMode('88')
        return handlers.onSwitchTo88?.()
      },
    })
    return false
  }

  private promptSuggestion(
    midi: MidiFile,
    currentTranspose: number,
    handlers: KeyboardModeResolutionHandlers,
  ): void {
    const options = getCompatibleTranspositions(midi, '61').map((option) => ({
      ...option,
      semitones: option.semitones + currentTranspose,
    }))
    this.opts.promptSuggestion({
      options,
      onTranspose: (semitones) => handlers.onTranspose(semitones),
      onSwitchTo88: () => handlers.onSwitchTo88?.(),
    })
  }
}
