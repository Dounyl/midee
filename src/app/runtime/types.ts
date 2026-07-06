import type { AppCtxValue } from '@/stores/app/AppCtx'
import type { MidiFile } from '@/types/midi/types'

export interface AppShellHandles {
  canvas: HTMLCanvasElement
  overlay: HTMLDivElement
}

export interface BenchRuntimeDriver {
  prepareBenchPlayback(midi: MidiFile): Promise<void>
  startBenchPlayback(): void
}

export interface AppRuntimeInstance {
  ctx: AppCtxValue
  bench: BenchRuntimeDriver
  dispose(): void
}
