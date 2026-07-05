import type { JSXElement } from 'solid-js'
import { createContext, useContext } from 'solid-js'
import { assertDefined } from '@/app/runtime/assert'
import type { AppShellHandles } from '@/app/runtime/types'

const AppShellContext = createContext<AppShellHandles>()

export function AppShellProvider(props: { handles: AppShellHandles; children: JSXElement }) {
  return <AppShellContext.Provider value={props.handles}>{props.children}</AppShellContext.Provider>
}

export function useAppShell(): AppShellHandles {
  return assertDefined(
    useContext(AppShellContext),
    'useAppShell() called outside <AppShellProvider>',
  )
}
