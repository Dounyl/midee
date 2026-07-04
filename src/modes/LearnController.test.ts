import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiFile } from '../core/midi/types'
import { LearnController } from './LearnController'

const runnerState = {
  active: false,
  activeId: null as string | null,
  launchCalls: [] as Array<{ id: string }>,
  closeCalls: [] as Array<'completed' | 'abandoned'>,
  closeResult: null as
    | {
        exerciseId: string
        duration_s: number
        accuracy: number
        xp: number
        weakSpots: string[]
        completed: boolean
      }
    | null,
}

const sessionSummaryShow = vi.fn()

function resetRunnerState() {
  runnerState.active = false
  runnerState.activeId = null
  runnerState.launchCalls = []
  runnerState.closeCalls = []
  runnerState.closeResult = null
  sessionSummaryShow.mockReset()
}

// LearnOverlay pulls in PixiJS (Container / Graphics) which needs a real
// WebGL context, not available in jsdom. Mock the whole module so
// `new LearnOverlay()` returns a plain object with enough surface area to
// satisfy the controller without touching graphics.
vi.mock('../learn/overlays/LearnOverlay', () => ({
  LearnOverlay: class {
    pulseTargetZone() {}
    drawLoopBand() {}
    celebrationSwell() {}
    update() {}
  },
}))

// ExerciseRunner.launch mounts a full exercise tree. Mocking it keeps the
// test focused on controller orchestration rather than exercise internals.
vi.mock('../learn/core/ExerciseRunner', () => ({
  ExerciseRunner: class {
    get isActive() {
      return runnerState.active
    }
    get activeId() {
      return runnerState.activeId
    }
    launch(descriptor: { id: string }) {
      runnerState.launchCalls.push(descriptor)
      runnerState.active = true
      runnerState.activeId = descriptor.id
      return Promise.resolve()
    }
    close(reason: 'completed' | 'abandoned') {
      runnerState.closeCalls.push(reason)
      runnerState.active = false
      runnerState.activeId = null
      return runnerState.closeResult
    }
  },
}))

// LearnHub.mount calls Solid render. Mocking it keeps the test hermetic and
// avoids bringing in the full catalog surface.
vi.mock('../learn/hub/LearnHub', () => ({
  createLearnHub: () => ({ mount: () => {}, unmount: () => {} }),
}))

// SessionSummary renders HTML into the hub host after an exercise closes.
// Not exercised directly here; we only need to observe that it would show.
vi.mock('../learn/ui/SessionSummary', () => ({
  createSessionSummary: () => ({ show: sessionSummaryShow, dismiss: () => {} }),
}))

vi.mock('../telemetry', () => ({
  track: vi.fn(),
  trackEvent: vi.fn(),
}))

// play-along/index.ts imports Tone. Mock the descriptor directly so the
// controller never touches that import chain.
vi.mock('../learn/exercises/play-along', () => ({
  playAlongDescriptor: {
    id: 'play-along',
    get title() {
      return 'Play Along'
    },
    category: 'play-along',
    difficulty: 'beginner',
    capabilities: {
      requiresLoadedMidi: true,
      usesOverlay: true,
      usesInputBus: true,
      supportsMidiReplacement: true,
    },
    get blurb() {
      return ''
    },
    factory: () => ({}),
  },
}))

// catalog.ts re-imports playAlongDescriptor; mock it independently so
// findExercise(id) also avoids the Tone resolution chain.
vi.mock('../learn/hub/catalog', () => ({
  findExercise: vi.fn(() => undefined),
  CATALOG: [],
}))

function makeMidi(name = 'test.mid'): MidiFile {
  return {
    name,
    duration: 30,
    bpm: 120,
    timeSignature: [4, 4] as [number, number],
    keySignature: null,
    tracks: [],
  }
}

function makeFakeCtx() {
  const storeState = { mode: 'play' as const }
  return {
    services: {
      store: {
        state: storeState,
        setState: vi.fn((key: string, val: unknown) => {
          ;(storeState as Record<string, unknown>)[key] = val
        }),
      },
      clock: {
        currentTime: 0,
        pause: vi.fn(),
        seek: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      },
      synth: {
        pause: vi.fn(),
        play: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue(undefined),
      },
      renderer: {
        clearMidi: vi.fn(),
        loadMidi: vi.fn(),
        setKeyboardMode: vi.fn(),
        setLiveNotesVisible: vi.fn(),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        setVisible: vi.fn(),
      },
      input: null as never,
      metronome: null as never,
    },
    overlay: document.createElement('div'),
    trackPanel: { close: vi.fn() },
    dropzone: { hide: vi.fn() },
    keyboardInput: { enable: vi.fn(), disable: vi.fn() },
    midiInput: null as never,
    resetInteractionState: vi.fn(),
    openFilePicker: vi.fn(),
    openLocalMidi: vi.fn(),
    primeInteractiveAudio: vi.fn(),
    setLearnFileName: vi.fn(),
    updateConsolePanel: vi.fn(),
    keyboardMode: {
      ensureMidiFitsCurrentMode: vi.fn(() => true),
      getMode: vi.fn(() => 'full'),
    },
  }
}

describe('LearnController.queueMidi', () => {
  beforeEach(() => {
    resetRunnerState()
  })

  it('does not consume the MIDI before enter() is called', () => {
    const ctrl = new LearnController(makeFakeCtx() as never)
    ctrl.queueMidi(makeMidi())
    expect(ctrl.learnState.state.loadedMidi).toBeNull()
  })

  it('enter() drains the queued MIDI into learnState', async () => {
    const ctx = makeFakeCtx()
    const ctrl = new LearnController(ctx as never)
    const midi = makeMidi('piece.mid')
    ctrl.queueMidi(midi)
    ctrl.enter()
    await Promise.resolve()
    expect(ctrl.learnState.state.loadedMidi?.name).toBe('piece.mid')
  })

  it('clears the queue after enter() so a second enter() does not replay the MIDI', async () => {
    const ctx = makeFakeCtx()
    const ctrl = new LearnController(ctx as never)
    ctrl.queueMidi(makeMidi())
    ctrl.enter()
    await Promise.resolve()
    const firstMidi = ctrl.learnState.state.loadedMidi

    ctrl.exit()
    ctrl.enter()
    await Promise.resolve()

    expect(ctrl.learnState.state.loadedMidi).toBeNull()
    expect(firstMidi).not.toBeNull()
  })

  it('enter() without a queued MIDI leaves learnState empty', async () => {
    const ctrl = new LearnController(makeFakeCtx() as never)
    ctrl.enter()
    await Promise.resolve()
    expect(ctrl.learnState.state.loadedMidi).toBeNull()
  })

  it('exposes the queued name via setLearnFileName after drain', async () => {
    const ctx = makeFakeCtx()
    const ctrl = new LearnController(ctx as never)
    ctrl.queueMidi(makeMidi('bach-prelude.mid'))
    ctrl.enter()
    await Promise.resolve()
    expect(ctx.setLearnFileName).toHaveBeenCalledWith('bach-prelude.mid')
  })

  it('auto-launches play-along after draining queued MIDI', async () => {
    const ctrl = new LearnController(makeFakeCtx() as never)
    ctrl.queueMidi(makeMidi('autostart.mid'))
    ctrl.enter()
    await Promise.resolve()
    await Promise.resolve()
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(runnerState.launchCalls[0]?.id).toBe('play-along')
  })

  it('exit() abandons an active runner', async () => {
    const ctrl = new LearnController(makeFakeCtx() as never)
    ctrl.queueMidi(makeMidi('active.mid'))
    ctrl.enter()
    await Promise.resolve()
    await Promise.resolve()

    ctrl.exit()

    expect(runnerState.closeCalls).toEqual(['abandoned'])
  })

  it('closing the active exercise returns Learn to a clean hub state', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0.9,
      xp: 10,
      weakSpots: [],
      completed: true,
    }
    const ctx = makeFakeCtx()
    const ctrl = new LearnController(ctx as never)
    ctrl.queueMidi(makeMidi('cleanup.mid'))
    ctrl.enter()
    await Promise.resolve()
    await Promise.resolve()

    ;(ctrl as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }).closeActiveExercise(
      'completed',
    )

    expect(runnerState.closeCalls).toEqual(['completed'])
    expect(ctrl.learnState.state.loadedMidi).toBeNull()
    expect(ctx.setLearnFileName).toHaveBeenLastCalledWith(null)
    expect(ctx.services.renderer.setVisible).toHaveBeenLastCalledWith(false)
    expect(sessionSummaryShow).toHaveBeenCalledOnce()
  })
})
