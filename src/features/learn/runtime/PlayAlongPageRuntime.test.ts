import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumePlayAlongReplayState } from '@/features/learn/exercises/play-along/state'
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
    summary?: {
      kind: 'play-along'
      completionTarget: 'song-end' | 'loop-end'
      perfect: number
      good: number
      errors: number
      heldTicks: number
      cleanPasses: number
      loopRegion: { start: number; end: number } | null
    }
  } | null,
}

const sessionSummaryShow = vi.fn()
const playAlongSummaryShow = vi.fn()
const playAlongSummaryDismiss = vi.fn()
let playAlongSummaryOptions: {
  onContinuePractice: () => void
  onCancel: () => void
} | null = null

function resetRunnerState() {
  runnerState.active = false
  runnerState.activeId = null
  runnerState.launchCalls = []
  runnerState.closeCalls = []
  runnerState.closeResult = null
  sessionSummaryShow.mockReset()
  playAlongSummaryShow.mockReset()
  playAlongSummaryDismiss.mockReset()
  playAlongSummaryOptions = null
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

vi.mock('@/features/learn/exercises/play-along/PlayAlongSummary', () => ({
  createPlayAlongSummary: (opts: { onContinuePractice: () => void; onCancel: () => void }) => {
    playAlongSummaryOptions = opts
    return { show: playAlongSummaryShow, dismiss: playAlongSummaryDismiss }
  },
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
      prime: vi.fn(),
      seek: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      play: vi.fn(),
      speed: 1,
    },
    synth: {
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      primeLiveInput: vi.fn(),
      resetTransport: vi.fn(),
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe('PlayAlongPageRuntime pending MIDI flow', () => {
  beforeEach(() => {
    resetRunnerState()
    localStorage.clear()
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
    await flushMicrotasks()
    expect(runtime.learnState.state.loadedMidi?.name).toBe('piece.mid')
  })

  it('clears the pending MIDI after enter() so a second enter() does not replay it', async () => {
    const midi = makeMidi()
    const deps = makeDeps(midi)
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    const firstMidi = runtime.learnState.state.loadedMidi

    runtime.exit()
    runtime.enter()
    await flushMicrotasks()

    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(firstMidi).not.toBeNull()
  })

  it('enter() without a pending MIDI leaves learnState empty', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps() as never)
    runtime.enter()
    await flushMicrotasks()
    expect(runtime.learnState.state.loadedMidi).toBeNull()
  })

  it('exposes the pending name via setLearnFileName after drain', async () => {
    const deps = makeDeps(makeMidi('bach-prelude.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    expect(deps.setLearnFileName).toHaveBeenCalledWith('bach-prelude.mid')
  })

  it('auto-launches play-along after draining pending MIDI', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('autostart.mid')) as never)
    runtime.enter()
    await flushMicrotasks()
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(runnerState.launchCalls[0]?.id).toBe('play-along')
  })

  it('resets synth transport before starting play-along from the page state', async () => {
    const deps = makeDeps(makeMidi('manual-start.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    const synthLoadCallsBeforeStart = deps.services.synth.load.mock.calls.length
    const launchCallsBeforeStart = runnerState.launchCalls.length
    const resetTransportCallsBeforeStart = deps.services.synth.resetTransport.mock.calls.length
    const clockPrimeCallsBeforeStart = deps.services.clock.prime.mock.calls.length
    const synthPrimeCallsBeforeStart = deps.services.synth.primeLiveInput.mock.calls.length

    runtime.view.set('page')
    runnerState.active = false
    runnerState.activeId = null

    await runtime.startPlayAlong()
    await flushMicrotasks()

    expect(deps.services.synth.resetTransport.mock.calls.length).toBe(
      resetTransportCallsBeforeStart + 1,
    )
    expect(deps.services.clock.prime.mock.calls.length).toBe(clockPrimeCallsBeforeStart + 1)
    expect(deps.services.synth.primeLiveInput.mock.calls.length).toBe(
      synthPrimeCallsBeforeStart + 1,
    )
    expect(deps.services.synth.load.mock.calls.length).toBe(synthLoadCallsBeforeStart)
    expect(runnerState.launchCalls).toHaveLength(launchCallsBeforeStart + 1)
    expect(runnerState.launchCalls.at(-1)?.id).toBe('play-along')
  })

  it('primes interactive audio before auto-launching play-along after MIDI load', async () => {
    const deps = makeDeps(makeMidi('autostart-prime.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)

    runtime.enter()
    await flushMicrotasks()

    expect(deps.services.clock.prime).toHaveBeenCalledOnce()
    expect(deps.services.synth.primeLiveInput).toHaveBeenCalledOnce()
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(runnerState.launchCalls[0]?.id).toBe('play-along')
  })

  it('waits for synth loading to finish before auto-launching play-along', async () => {
    const deferred = createDeferred<void>()
    const deps = makeDeps(makeMidi('delayed-load.mid'))
    deps.services.synth.load = vi.fn(() => deferred.promise)
    const runtime = new PlayAlongPageRuntime(deps as never)

    runtime.enter()
    await flushMicrotasks()

    expect(deps.services.synth.load).toHaveBeenCalledOnce()
    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(runnerState.launchCalls).toHaveLength(0)

    deferred.resolve()
    await flushMicrotasks()

    expect(runtime.learnState.state.loadedMidi?.name).toBe('delayed-load.mid')
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(runnerState.launchCalls[0]?.id).toBe('play-along')
  })

  it('ignores a late synth load completion after exit()', async () => {
    const deferred = createDeferred<void>()
    const deps = makeDeps(makeMidi('late-load.mid'))
    deps.services.synth.load = vi.fn(() => deferred.promise)
    const runtime = new PlayAlongPageRuntime(deps as never)

    runtime.enter()
    await flushMicrotasks()
    runtime.exit()

    deferred.resolve()
    await flushMicrotasks()

    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(runnerState.launchCalls).toHaveLength(0)
  })

  it('exit() abandons an active runner', async () => {
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('active.mid')) as never)
    runtime.enter()
    await flushMicrotasks()

    runtime.exit()

    expect(runnerState.closeCalls).toEqual(['abandoned'])
  })

  it('returnToList() abandons the active exercise and restores the page view', async () => {
    const deps = makeDeps(makeMidi('return.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()

    runtime.returnToList()

    expect(runnerState.closeCalls).toEqual(['abandoned'])
    expect(runtime.view.value).toBe('page')
    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(deps.services.renderer.setVisible).toHaveBeenLastCalledWith(false)
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
    await flushMicrotasks()

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    expect(runnerState.closeCalls).toEqual(['completed'])
    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(deps.setLearnFileName).toHaveBeenLastCalledWith(null)
    expect(deps.services.renderer.setVisible).toHaveBeenLastCalledWith(false)
    expect(sessionSummaryShow).toHaveBeenCalledOnce()
  })

  it('shows the dedicated play-along summary for completed song-end runs', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0.9,
      xp: 10,
      weakSpots: [],
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'song-end',
        perfect: 8,
        good: 2,
        errors: 1,
        heldTicks: 5,
        cleanPasses: 0,
        loopRegion: null,
      },
    }
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('song-end.mid')) as never)
    runtime.enter()
    await flushMicrotasks()

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    expect(playAlongSummaryShow).toHaveBeenCalledOnce()
    expect(sessionSummaryShow).not.toHaveBeenCalled()
    expect(runtime.view.value).toBe('exercise')
  })

  it('shows the dedicated play-along summary even when a song-end run has no attempts', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0,
      xp: 0,
      weakSpots: [],
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'song-end',
        perfect: 0,
        good: 0,
        errors: 0,
        heldTicks: 0,
        cleanPasses: 0,
        loopRegion: null,
      },
    }
    const runtime = new PlayAlongPageRuntime(makeDeps(makeMidi('song-end-empty.mid')) as never)
    runtime.enter()
    await flushMicrotasks()

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    expect(playAlongSummaryShow).toHaveBeenCalledOnce()
    expect(sessionSummaryShow).not.toHaveBeenCalled()
    expect(playAlongSummaryShow.mock.calls[0]?.[1]).toMatchObject({
      accuracy: 0,
      xp: 0,
    })
    expect(runtime.view.value).toBe('exercise')
  })

  it('shows the dedicated play-along summary for completed loop-end runs', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 8,
      accuracy: 0.92,
      xp: 10,
      weakSpots: [],
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'loop-end',
        perfect: 6,
        good: 1,
        errors: 0,
        heldTicks: 4,
        cleanPasses: 2,
        loopRegion: { start: 2, end: 10 },
      },
    }
    const deps = makeDeps(makeMidi('loop-end.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    const clearMidiCallsBeforeClose = deps.services.renderer.clearMidi.mock.calls.length
    const setVisibleCallsBeforeClose = deps.services.renderer.setVisible.mock.calls.length
    const setLearnFileNameCallsBeforeClose = deps.setLearnFileName.mock.calls.length

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    expect(playAlongSummaryShow).toHaveBeenCalledOnce()
    expect(sessionSummaryShow).not.toHaveBeenCalled()
    expect(playAlongSummaryShow.mock.calls[0]?.[3]).toMatchObject({
      completionTarget: 'loop-end',
      loopRegion: { start: 2, end: 10 },
    })
    expect(runtime.view.value).toBe('exercise')
    expect(runtime.learnState.state.loadedMidi?.name).toBe('loop-end.mid')
    expect(deps.services.renderer.clearMidi.mock.calls.length).toBe(clearMidiCallsBeforeClose)
    expect(deps.services.renderer.setVisible.mock.calls.length).toBe(setVisibleCallsBeforeClose)
    expect(deps.setLearnFileName.mock.calls.length).toBe(setLearnFileNameCallsBeforeClose)
  })

  it('dismisses the play-along summary without restarting when cancel is pressed', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0.9,
      xp: 10,
      weakSpots: [],
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'song-end',
        perfect: 8,
        good: 2,
        errors: 1,
        heldTicks: 5,
        cleanPasses: 0,
        loopRegion: null,
      },
    }
    const deps = makeDeps(makeMidi('cancel.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    const clearMidiCallsBeforeClose = deps.services.renderer.clearMidi.mock.calls.length

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    playAlongSummaryOptions?.onCancel()
    await Promise.resolve()

    expect(playAlongSummaryDismiss).toHaveBeenCalledOnce()
    expect(runnerState.launchCalls).toHaveLength(1)
    expect(deps.services.renderer.clearMidi.mock.calls.length).toBeGreaterThan(
      clearMidiCallsBeforeClose,
    )
    expect(runtime.learnState.state.loadedMidi).toBeNull()
    expect(runtime.view.value).toBe('page')
  })

  it('returns to the play-along screen without auto-launching when continue practicing is pressed', async () => {
    runnerState.closeResult = {
      exerciseId: 'play-along',
      duration_s: 12,
      accuracy: 0.9,
      xp: 10,
      weakSpots: [],
      completed: true,
      summary: {
        kind: 'play-along',
        completionTarget: 'song-end',
        perfect: 8,
        good: 2,
        errors: 1,
        heldTicks: 5,
        cleanPasses: 0,
        loopRegion: null,
      },
    }
    const deps = makeDeps(makeMidi('continue.mid'))
    const runtime = new PlayAlongPageRuntime(deps as never)
    runtime.enter()
    await flushMicrotasks()
    const clearMidiCallsBeforeClose = deps.services.renderer.clearMidi.mock.calls.length
    const setVisibleCallsBeforeClose = deps.services.renderer.setVisible.mock.calls.length
    const setLearnFileNameCallsBeforeClose = deps.setLearnFileName.mock.calls.length
    const launchCallsBeforeContinue = runnerState.launchCalls.length
    const synthLoadCallsBeforeContinue = deps.services.synth.load.mock.calls.length

    ;(
      runtime as unknown as { closeActiveExercise(reason: 'completed' | 'abandoned'): void }
    ).closeActiveExercise('completed')

    playAlongSummaryOptions?.onContinuePractice()
    await flushMicrotasks()

    expect(playAlongSummaryDismiss).toHaveBeenCalledOnce()
    expect(runnerState.launchCalls).toHaveLength(launchCallsBeforeContinue + 1)
    expect(runnerState.launchCalls.at(-1)?.id).toBe('play-along')
    expect(deps.services.renderer.clearMidi.mock.calls.length).toBe(clearMidiCallsBeforeClose)
    expect(deps.services.renderer.setVisible.mock.calls.length).toBeGreaterThan(
      setVisibleCallsBeforeClose,
    )
    expect(deps.services.renderer.setVisible.mock.calls.at(-1)?.[0]).toBe(true)
    expect(deps.setLearnFileName.mock.calls.length).toBe(setLearnFileNameCallsBeforeClose)
    expect(deps.services.synth.resetTransport).toHaveBeenCalled()
    expect(deps.services.synth.load.mock.calls.length).toBe(synthLoadCallsBeforeContinue)
    expect(deps.services.clock.seek).toHaveBeenCalledWith(0)
    expect(deps.services.synth.seek).toHaveBeenCalledWith(0)
    expect(consumePlayAlongReplayState()).toEqual({
      loopRegion: null,
      startTime: 0,
      autoplay: false,
    })
    expect(runtime.learnState.state.loadedMidi?.name).toBe('continue.mid')
    expect(runtime.view.value).toBe('exercise')
  })
})
