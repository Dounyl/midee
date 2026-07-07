import type { WireRuntimeInputOptions } from '@/app/runtime/wireRuntimeInput'

export interface CreateRuntimeInputOptions {
  midi: WireRuntimeInputOptions['midi']
  keyboard: WireRuntimeInputOptions['keyboard']
  touch: WireRuntimeInputOptions['touch']
  bridge: WireRuntimeInputOptions['bridge']
}

export function createRuntimeInputOptions(
  options: CreateRuntimeInputOptions,
): WireRuntimeInputOptions {
  return {
    midi: options.midi,
    keyboard: options.keyboard,
    touch: options.touch,
    bridge: options.bridge,
  }
}
