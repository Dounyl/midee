import type { WireRuntimeEffectsOptions } from '@/app/runtime/wireRuntimeEffects'
import type { RuntimeUiBridge } from '@/services/runtime/RuntimeUiBridge'

export interface CreateRuntimeEffectsOptions {
  ui: RuntimeUiBridge
  route: WireRuntimeEffectsOptions['route']
  playback: WireRuntimeEffectsOptions['playback']
  midi: WireRuntimeEffectsOptions['midi']
}

export function createRuntimeEffectsOptions(
  options: CreateRuntimeEffectsOptions,
): WireRuntimeEffectsOptions {
  return {
    ui: options.ui,
    route: options.route,
    playback: options.playback,
    midi: options.midi,
  }
}
