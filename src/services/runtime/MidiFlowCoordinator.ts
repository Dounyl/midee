import { MidiLoadFlow } from '@/services/midi/MidiLoadFlow'
import type { LearnEnterRequest } from '@/stores/app/AppCtx'
import type { MidiFile } from '@/types/midi/types'
import type {
  DisplayPrefsState,
  MidiOpenSource,
  MidiOpenTarget,
  PlaybackSessionState,
  RuntimeNavigationPort,
  RuntimeServicesCtx,
  RuntimeUiPort,
} from './contracts'

interface MidiFlowCoordinatorOptions {
  services: RuntimeServicesCtx
  ui: RuntimeUiPort
  navigation: RuntimeNavigationPort
  displayPrefs: DisplayPrefsState
  playbackSession: PlaybackSessionState
  keyboardInput: { enable(): void }
  onSyncConsolePanel: () => void
  onResetInteractionState: () => void
  handoffPreparedPlayAlong: (midi: MidiFile) => Promise<void>
  resetPlaybackTelemetry: () => void
}

export class MidiFlowCoordinator {
  private readonly flow: MidiLoadFlow

  constructor(opts: MidiFlowCoordinatorOptions) {
    this.flow = new MidiLoadFlow(opts)
  }

  async openFile(
    file: File,
    source: Extract<MidiOpenSource, 'drag' | 'picker'>,
    target: MidiOpenTarget,
  ): Promise<void> {
    await this.flow.openFile(file, source, target)
  }

  async openSample(sampleId: string, target: MidiOpenTarget): Promise<void> {
    await this.flow.openSample(sampleId, target)
  }

  async openLocal(id: string, target: MidiOpenTarget): Promise<void> {
    await this.flow.openLocal(id, target)
  }

  async enterLearn(request: LearnEnterRequest): Promise<void> {
    await this.flow.enterLearn(request)
  }

  loadSessionMidi(midi: MidiFile): void {
    this.flow.loadSessionMidi(midi)
  }
}
