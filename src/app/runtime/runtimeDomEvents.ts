export interface RuntimeDomEventBindingsOptions {
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener'>
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>
  onVisibilityChange(): void
  onWindowBlur(): void
  onFirstPointerDown(): void
  onFirstKeyDown(): void
}

export function bindRuntimeDomEvents(options: RuntimeDomEventBindingsOptions): () => void {
  options.documentTarget.addEventListener('visibilitychange', options.onVisibilityChange)
  options.windowTarget.addEventListener('blur', options.onWindowBlur)
  options.windowTarget.addEventListener('pointerdown', options.onFirstPointerDown, {
    passive: true,
  })
  options.windowTarget.addEventListener('keydown', options.onFirstKeyDown, { passive: true })

  return () => {
    options.documentTarget.removeEventListener('visibilitychange', options.onVisibilityChange)
    options.windowTarget.removeEventListener('blur', options.onWindowBlur)
    options.windowTarget.removeEventListener('pointerdown', options.onFirstPointerDown)
    options.windowTarget.removeEventListener('keydown', options.onFirstKeyDown)
  }
}
