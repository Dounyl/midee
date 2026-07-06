import type { MidiFile } from '@/types/midi/types'

export interface AudioEngine {
  load(source: MidiFile | AudioBuffer): Promise<void>
  play(fromTime: number): Promise<void>
  pause(): void
  seek(time: number): void
  setVolume(v: number): void // 0鈥?
  setSpeed(s: number): void // 0.25鈥?
  dispose(): void
}
