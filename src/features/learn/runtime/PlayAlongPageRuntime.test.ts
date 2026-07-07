import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiFile } from '@/types/midi/types'
import { PlayAlongPageRuntime } from './PlayAlongPageRuntime'

const runnerState = {
  active: false,
  activeId: null as string | null,
  launchCalls: [] as Array<{ id: string }>,
  closeCalls: [] as Array<'completed' | 'abandoned'>,
  closeResult: null as {
    exerciseId: string
    duration_s: number
    accuracy: number
    xp: number
    weakSpots: string[]
    completed: boolean
  } | null,
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

vi.mock('@/features/learn/overlays/LearnOverlay', () => ({
  LearnOverlay: class {
    pulseTargetZone() {}
    drawLoopBand() {}
    celebrationSwell() {}
    update() {}
  },
}))

vi.mock('@/features/learn/core/ExerciseRunner', () => ({
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
    replaceMidi() {}
  },
}))

vi.mock('@/features/learn/ui/SessionSummary', () => ({
  createSessionSummary: () => ({ show: sessionSummaryShow, dismiss: () => {} }),
}))

vi.mock('@/services/telemetry', () => ({
  track: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/features/learn/exercises/play-along', () => ({
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

vi.mock('@/features/learn/hub/registry', () => ({
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

function makeDeps(pendingMidi: MidiFile | null = null) {
  const pendingRef = { current: pendingMidi }
  const services = {
    store: {
      state: { status: 'ready' as const },
      setState: vi.fn(),
    },
    clock: {
      currentTime: 0,
      pause: vi.fn(),
      seek: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      play: vi.fn(),
      speed: 1,
    },
    synth: {
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn(),
      setSpeed: vi.fn(),
    },
    renderer: {
      clearMidi: vi.fn(),
      loadMidi: vi.fn(),
      setKeyboardMode: vi.fn(),
      setLiveNotesVisible: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      setVisible: vi.fn(),
      setPracticeTrackFocus: vi.fn(),
    },
    input: null as never,
    metronome: null as never,
  }

  return {
    services,
    overlayRoot: document.createElement('div'),
    keyboardMode: {
      ensureMidiFitsCurrentMode: vi.fn(() => true),
      getMode: vi.fn(() => '88'),
    } as never,
    setLearnFileName: vi.fn(),
    updateConsolePanel: vi.fn(),
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    consumePendingMidi: vi.fn(() => {
      const midi = pendingRef.current
      pendingRef.current = null
      return midi
    }),
  }
}

describe('PlayAlongPageRuntime pending MIDI flow', () => {
  beforeEach(() => {
    resetRunnerState()
  })

  it('does not consume MIDI before enter() is called', () => {
    const midi = makeMidi()
    const deps = makeDeps(midi)
    const runtime = new PlayAlongPageRuntime(deps as never)
    expect(runtime.learnState.state.loadedMidi).toBeNull()
  })

  it('enter() drains the pending MIDI into learnState', async () => {
    const midi = makeMidi('piece.mid')
    const deps = makeDeps(midi)
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await Promise.resolve()
    expect(runtime.learnState.state.loadedMidi?.name).toBe('piece.mid')
  })

  it('clears the pending MIDI after enter() so a second enter() does not replay it', async () => {
    const midi = makeMidi()
    const deps = makeDeps(midi)
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await Promise.resolve()
    const firstMidi = runtime.learnState.state.loadedMidi

    runtime.exit()
    runtime.enter()
    await Promise.resolve()

    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(firstMidi).not.toBeNull()
  })

  it('enter() without a pending MIDI leaves learnState empty', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps() as never)
    runtime.enter()
    await Promise.resolve()
    expect(runtime.learnState.state.loadedMidi).toBeNull()
  })

  it('exposes the pending name via setLearnFileName after drain', async () => {
    const deps = makeDeps(makeMidi('bach-prelude.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await Promise.resolve()
    expect(deps.setLearnFileName).toHaveBeenCalledWith('bach-prelude.mid')
  })

  it('auto-launches play-along after draining pending MIDI', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('autostart.mid')) as never)
    runtime.enter()
    await Promise.resolve()
    await Promise.resolve()
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(runnerState.launchCalls[0]?.id).toBe('play-along')
  })

  it('exit() abandons an active runner', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('active.mid')) as never)
    runtime.enter()
    await Promise.resolve()
    await Promise.resolve()

    runtime.exit()

    expect(runnerState.closeCalls).toEqual(['abandoned'])
  })

  it('closing the active exercise returns Learn to a clean routed state', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0.9,
      xp: 10,
      weakSpots: [],
      completed: true,
    }
    const deps = makeDeps(makeMidi('cleanup.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await Promise.resolve()
    await Promise.resolve()

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    expect(runnerState.closeCalls).toEqual(['completed'])
    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(deps.setLearnFileName).toHaveBeenLastCalledWith(null)
    expect(deps.services.renderer.setVisible).toHaveBeenLastCalledWith(false)
    expect(sessionSummaryShow).toHaveBeenCalledOnce()
  })
})
