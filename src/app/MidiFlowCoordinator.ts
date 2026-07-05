import type { LearnEnterRequest } from '@/stores/app/AppCtx'
import type { MidiFile } from '../core/midi/types'
import { MidiLoadFlow } from './midi/MidiLoadFlow'
import type { RuntimeUiBridge } from './RuntimeUiBridge'
import type { AppRuntimeDeps, ExportOverlayState, MidiOpenSource, MidiOpenTarget } from './types'

interface MidiFlowCoordinatorOptions extends AppRuntimeDeps {
  keyboardInput: { enable(): void }
  ui: RuntimeUiBridge
  state: ExportOverlayState
  onSyncConsolePanel: () => void
  onResetInteractionState: () => void
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
