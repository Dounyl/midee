import { createSignal } from 'solid-js'
import type { EnterOptions } from '../../modes/ModeController'

const [pendingOpts, setPendingOpts] = createSignal<EnterOptions>({ primeAudio: true })

export function setNextLiveOpts(opts: EnterOptions): void {
  setPendingOpts(opts)
}

export function consumeNextLiveOpts(): EnterOptions {
  const opts = pendingOpts()
  setPendingOpts({ primeAudio: true })
  return opts
}
