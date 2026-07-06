import { AppRouter } from '@/app/router/AppRouter'

// Router-owned page content that mounts inside the Solid-owned shell.
export function AppRoot() {
  return <AppRouter />
}
