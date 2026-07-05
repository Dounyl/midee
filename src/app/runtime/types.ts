import type { AppCtxValue } from '@/stores/app/AppCtx'

export interface AppShellHandles {
  canvas: HTMLCanvasElement
  overlay: HTMLDivElement
}

export interface AppRuntimeInstance {
  ctx: AppCtxValue
  dispose(): void
}
