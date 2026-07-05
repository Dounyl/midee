import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { AppRoot } from '@/app/App'
import { AppShellProvider } from '@/app/AppShellContext'
import { createApp } from '@/app/createApp'
import { assertDefined } from '@/app/runtime/assert'
import type { AppRuntimeInstance } from '@/app/runtime/types'
import { FpsOverlay } from '@/components/common/FpsOverlay'
import { SHOW_FPS } from '@/env'
import { AppCtx, type AppCtxValue } from '@/stores/app/AppCtx'

interface AppShellProps {
  onReady?: (ctx: AppCtxValue) => void | Promise<void>
  onError?: (error: unknown) => void
}

export function AppShell(props: AppShellProps) {
  const [ctx, setCtx] = createSignal<AppCtxValue | null>(null)
  let canvas: HTMLCanvasElement | undefined
  let overlay: HTMLDivElement | undefined
  let runtime: AppRuntimeInstance | null = null
  let cancelled = false
  const shellHandles = () => ({
    canvas: assertDefined(canvas, 'App shell mounted without a piano-roll canvas'),
    overlay: assertDefined(overlay, 'App shell mounted without an overlay host'),
  })

  onMount(() => {
    void (async () => {
      try {
        runtime = await createApp(shellHandles())
        if (cancelled) {
          runtime.dispose()
          runtime = null
          return
        }
        setCtx(runtime.ctx)
        await props.onReady?.(runtime.ctx)
      } catch (error) {
        if (!cancelled) props.onError?.(error)
      }
    })()
  })

  onCleanup(() => {
    cancelled = true
    runtime?.dispose()
    runtime = null
  })

  return (
    <>
      <canvas id="pianoroll" ref={canvas} />
      <div id="ui-overlay" ref={overlay}>
        <div id="solid-root">
          <Show when={ctx()}>
            {(value) => (
              <AppShellProvider handles={shellHandles()}>
                <AppCtx.Provider value={value()}>
                  <AppRoot />
                  <Show when={SHOW_FPS}>
                    <FpsOverlay />
                  </Show>
                </AppCtx.Provider>
              </AppShellProvider>
            )}
          </Show>
        </div>
      </div>
    </>
  )
}
