import { onMount } from 'solid-js'
import { useApp } from '../../store/AppCtx'

export function HomePage() {
  const { services, actions } = useApp()

  onMount(() => {
    services.store.enterHome()
    actions.home.enter()
  })

  return null
}
