export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function hexToCSS(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export function cssModuleClass(
  styles: Record<string, string>,
  ...names: Array<string | false | null | undefined>
): string {
  return names
    .filter((name): name is string => Boolean(name))
    .map((name) => styles[name] ?? '')
    .filter(Boolean)
    .join(' ')
}

const NARROW_VIEWPORT_MQ = '(max-width: 640px)'

export function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(NARROW_VIEWPORT_MQ).matches
}

export function installViewportClassSync(): () => void {
  const body = document.body
  const coarse = window.matchMedia('(pointer: coarse)')
  const narrow = window.matchMedia(NARROW_VIEWPORT_MQ)

  const syncCoarse = (): void => {
    body.classList.toggle('is-touch', coarse.matches)
  }
  const syncNarrow = (): void => {
    body.classList.toggle('is-narrow', narrow.matches)
  }
  syncCoarse()
  syncNarrow()

  coarse.addEventListener('change', syncCoarse)
  narrow.addEventListener('change', syncNarrow)

  return () => {
    coarse.removeEventListener('change', syncCoarse)
    narrow.removeEventListener('change', syncNarrow)
  }
}
