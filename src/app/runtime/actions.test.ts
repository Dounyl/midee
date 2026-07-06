import { describe, expect, it, vi } from 'vitest'
import type { AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import { createAppActions } from '@/app/runtime/actions'
import type { MidiFile } from '@/types/midi/types'

function createDriver(): AppIntentDriver {
  return {
    navigate: vi.fn(),
    enterHomeRoute: vi.fn(),
    enterPlayRoute: vi.fn(),
    enterLiveRoute: vi.fn(),
    openLibraryRequest: vi.fn(),
    enterLearnHub: vi.fn(async () => {}),
    exitLearnHub: vi.fn(),
    enterExerciseRoute: vi.fn(async () => {}),
    exitExerciseRoute: vi.fn(),
    enterLearnRequest: vi.fn(),
    openPreparedPlayAlong: vi.fn(async (_midi: MidiFile) => {}),
    resetInteractionState: vi.fn(),
    primeInteractiveAudio: vi.fn(),
  }
}

describe('createAppActions', () => {
  it('maps mode navigation to canonical route targets', () => {
    const driver = createDriver()
    const actions = createAppActions(driver)

    actions.navigation.toMode('learn')

    expect(driver.navigate).toHaveBeenCalledWith({ kind: 'learn-hub' }, undefined)
  })

  it('dispatches learn hub and exercise entry through the intent driver', async () => {
    const driver = createDriver()
    const actions = createAppActions(driver)
    const controller = new AbortController()

    await actions.learn.enterHub(controller.signal)
    await actions.learn.enterExercise('sight-reading', controller.signal)

    expect(driver.enterLearnHub).toHaveBeenCalledWith(controller.signal)
    expect(driver.enterExerciseRoute).toHaveBeenCalledWith('sight-reading', controller.signal)
  })

  it('forwards current-midi learn entry without route-specific branching in the caller', () => {
    const driver = createDriver()
    const actions = createAppActions(driver)

    actions.learn.enter({ kind: 'current-midi' })

    expect(driver.enterLearnRequest).toHaveBeenCalledWith({ kind: 'current-midi' })
  })
})
