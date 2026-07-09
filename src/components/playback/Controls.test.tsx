import { afterEach, describe, expect, it, vi } from 'vitest'
import { createControls } from '@/components/playback/Controls'
import { syncCurrentRoute } from '@/stores/routing/routerBridge'
import type { AppActions } from '@/stores/app/AppCtx'
import { createAppStore } from '@/stores/app/state'
import { fakeClock } from '@/test/fakeClock'
import type { AppServices } from '@/types/app/AppServices'
import type { MidiFile } from '@/types/midi/types'

function fakeMidi(name = 'demo.mid', duration = 12.5): MidiFile {
  return { name, duration, bpm: 120, timeSignature: [4, 4], keySignature: null, tracks: [] }
}

function makeActions(): AppActions {
  return {
    navigation: { toTarget: vi.fn() },
    play: { enter: vi.fn() },
    live: { enter: vi.fn() },
    library: { open: vi.fn() },
    learn: {
      enterHub: vi.fn(async () => {}),
      exitHub: vi.fn(),
      enterExercise: vi.fn(async () => {}),
      exitExercise: vi.fn(),
      enter: vi.fn(),
    },
    session: {
      resetInteractionState: vi.fn(),
      primeInteractiveAudio: vi.fn(),
    },
  }
}

function makeServices(): AppServices {
  const store = createAppStore()
  store.completePlayLoad(fakeMidi())
  const clock = fakeClock()
  return {
    store,
    clock: clock as unknown as AppServices['clock'],
    synth: {} as AppServices['synth'],
    metronome: {} as AppServices['metronome'],
    renderer: {} as AppServices['renderer'],
    input: {} as AppServices['input'],
  }
}

describe('Controls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
    syncCurrentRoute('/play')
  })

  it('uses the store status as the play/pause source of truth across rapid toggles', () => {
    syncCurrentRoute('/play')
    const services = makeServices()
    const container = document.createElement('div')
    document.body.appendChild(container)

    const controls = createControls(container, {
      services,
      actions: makeActions(),
    })

    const playButton = document.querySelector<HTMLButtonElement>('#hud-play')
    expect(playButton).not.toBeNull()

    playButton!.click()
    expect(services.store.state.status).toBe('playing')
    expect((services.clock as unknown as ReturnType<typeof fakeClock>).play).toHaveBeenCalledOnce()

    playButton!.click()
    expect(services.store.state.status).toBe('paused')
    expect((services.clock as unknown as ReturnType<typeof fakeClock>).pause).toHaveBeenCalledOnce()

    controls.dispose()
  })
})
