import { render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/app/AppShell'
import type { AppCtxValue } from '@/stores/app/AppCtx'
import { createAppStore } from '@/stores/app/state'

const createAppMock = vi.fn()

vi.mock('@/app/createApp', () => ({
  createApp: (handles: unknown) => createAppMock(handles),
}))

vi.mock('@/app/AppRoot', () => ({
  AppRoot: () => null,
}))

function makeCtx(): AppCtxValue {
  const store = createAppStore()
  return {
    store,
    actions: {
      navigation: { toTarget: vi.fn() },
      home: { enter: vi.fn() },
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
    },
    learnRuntime: {
      createPlayAlongPageRuntime: vi.fn(() => null as never),
      createExercisePageRuntime: vi.fn(() => null as never),
    },
  }
}

describe('AppShell', () => {
  afterEach(() => {
    createAppMock.mockReset()
    window.history.pushState({}, '', '/')
  })

  it('boots from shell refs and disposes the runtime on cleanup', async () => {
    const dispose = vi.fn()
    const onReady = vi.fn()
    const onRuntimeReady = vi.fn()
    const ctx = makeCtx()
    createAppMock.mockResolvedValue({
      ctx,
      bench: {
        prepareBenchPlayback: vi.fn(),
        startBenchPlayback: vi.fn(),
      },
      dispose,
    })

    const result = render(() => <AppShell onReady={onReady} onRuntimeReady={onRuntimeReady} />)

    await vi.waitFor(() => expect(createAppMock).toHaveBeenCalledOnce())
    const handles = createAppMock.mock.calls[0]?.[0] as unknown as {
      canvas: HTMLCanvasElement
      overlay: HTMLDivElement
    }
    expect(handles.canvas.id).toBe('pianoroll')
    expect(handles.overlay.id).toBe('ui-overlay')
    expect(document.querySelector('#solid-root')).not.toBeNull()
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith(ctx))
    await vi.waitFor(() => expect(onRuntimeReady).toHaveBeenCalledOnce())

    result.unmount()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
