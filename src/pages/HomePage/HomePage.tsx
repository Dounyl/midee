import { onMount } from 'solid-js'
import { useApp } from '@/stores/app/AppCtx'

export function HomePage() {
  const { actions } = useApp()

  onMount(() => {
    actions.home.enter()
  })

  return null
}
