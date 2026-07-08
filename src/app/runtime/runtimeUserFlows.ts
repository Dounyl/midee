import { resolveRuntimeOpenTarget } from '@/app/runtime/runtimeRouteSemantics'
import { t } from '@/i18n'
import { track } from '@/services/telemetry'
import type { RouteTarget } from '@/stores/routing/routeTarget'

interface MidiPickerModalPort {
  open(options: {
    onFile: (file: File) => void
    onSamplePlay: (id: string) => void
    onSamplePractice: (id: string) => void
  }): void
}

export interface ConnectRuntimeMidiOptions {
  midiInput: {
    status: { value: 'unavailable' | 'disconnected' | 'connected' | 'blocked' }
    requestAccess(options?: { silent?: boolean }): Promise<boolean>
  }
  primeInteractiveAudio(): void
  showError(message: string): void
}

export async function connectRuntimeMidi(options: ConnectRuntimeMidiOptions): Promise<void> {
  options.primeInteractiveAudio()
  const wasBlocked = options.midiInput.status.value === 'blocked'
  track('midi_permission_requested', { was_blocked: wasBlocked })
  const ok = await options.midiInput.requestAccess()
  if (ok) {
    track('midi_permission_granted')
    return
  }
  if (options.midiInput.status.value === 'blocked') {
    track('midi_permission_denied', { was_blocked: wasBlocked })
    const msg = wasBlocked ? t('error.midi.permissionBlocked') : t('error.midi.permissionDenied')
    options.showError(msg)
  }
}

export interface OpenRuntimeFilePickerOptions {
  target: 'play' | 'learn' | undefined
  getCurrentRouteTarget(): RouteTarget | null
  getMidiPickerModal(): Promise<MidiPickerModalPort>
  midiFlow: {
    openFile(file: File, source: 'picker', target: 'play' | 'learn'): Promise<void> | void
    openSample(sampleId: string, target: 'play' | 'learn'): Promise<void> | void
  }
  appController: {
    enterLearnRequest(request: { kind: 'sample'; sampleId: string }): Promise<void> | void
  }
}

export function openRuntimeFilePicker(options: OpenRuntimeFilePickerOptions): void {
  const resolveTarget = (): 'play' | 'learn' =>
    resolveRuntimeOpenTarget(options.getCurrentRouteTarget(), options.target)
  void options.getMidiPickerModal().then((modal) => {
    modal.open({
      onFile: (file) => void options.midiFlow.openFile(file, 'picker', resolveTarget()),
      onSamplePlay: (id) => void options.midiFlow.openSample(id, 'play'),
      onSamplePractice: (id) =>
        void options.appController.enterLearnRequest({ kind: 'sample', sampleId: id }),
    })
  })
}
