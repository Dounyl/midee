import type loadingStyles from '@/app.module.css'

interface ModalLike {
  close(): void
}

interface LazyPeekHandle<T> {
  peek(): T | null
}

export interface AppRuntimeUiShell {
  showLoading(): void
  hideLoading(): void
  showError(message: string): void
  showSuccess(message: string): void
  closeTransientOverlays(): void
}

export interface CreateAppRuntimeUiShellOptions {
  overlay: HTMLElement
  loadingStyles: typeof loadingStyles
  exportHandle: LazyPeekHandle<ModalLike>
  postSessionHandle: LazyPeekHandle<ModalLike>
  midiPickerHandle: LazyPeekHandle<ModalLike>
  showError(message: string): void
  showSuccess(message: string): void
}

export function createAppRuntimeUiShell(
  options: CreateAppRuntimeUiShellOptions,
): AppRuntimeUiShell {
  let loadingEl: HTMLElement | null = null

  return {
    showLoading() {
      loadingEl = document.createElement('div')
      loadingEl.id = 'loading-overlay'
      loadingEl.className = options.loadingStyles.loadingOverlay!
      loadingEl.innerHTML = `
      <div class="${options.loadingStyles.loadingInner!}">
        <div class="${options.loadingStyles.loadingSpinner!}"></div>
        <div class="${options.loadingStyles.loadingText!}">Loading...</div>
      </div>
    `
      options.overlay.appendChild(loadingEl)
    },
    hideLoading() {
      loadingEl?.remove()
      loadingEl = null
    },
    showError(message) {
      options.showError(message)
    },
    showSuccess(message) {
      options.showSuccess(message)
    },
    closeTransientOverlays() {
      options.exportHandle.peek()?.close()
      options.postSessionHandle.peek()?.close()
      options.midiPickerHandle.peek()?.close()
    },
  }
}
