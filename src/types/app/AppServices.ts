import type { MasterClock } from '@/lib/core/MasterClock'
import type { Metronome } from '@/services/audio/Metronome'
import type { SynthEngine } from '@/services/audio/SynthEngine'
import type { InputBus } from '@/services/input/InputBus'
import type { PianoRollRenderer } from '@/services/renderer/PianoRollRenderer'
import type { AppPublicStore } from '@/stores/app/state'

// Bundle of genuinely cross-cutting services passed to runtime owners.
// Feature-scoped primitives stay in their feature context instead of this bag.
export interface AppServices {
  store: AppPublicStore
  clock: MasterClock
  synth: SynthEngine
  metronome: Metronome
  renderer: PianoRollRenderer
  input: InputBus
}
