import { describe, expect, it, vi } from 'vitest'
import { createAppRuntimeUiShell } from '@/app/runtime/appRuntimeUiShell'

describe('createAppRuntimeUiShell', () => {
  it('manages loading overlay and transient modal closing through narrow handles', () => {
    const overlay = document.createElement('div')
    const exportClose = vi.fn()
    const postClose = vi.fn()
    const pickerClose = vi.fn()
    const showError = vi.fn()
    const showSuccess = vi.fn()

    const shell = createAppRuntimeUiShell({
      overlay,
      loadingStyles: {
        loadingOverlay: 'loading-overlay',
        loadingInner: 'loading-inner',
        loadingSpinner: 'loading-spinner',
        loadingText: 'loading-text',
      } as never,
      exportHandle: { peek: () => ({ close: exportClose }) },
      postSessionHandle: { peek: () => ({ close: postClose }) },
      midiPickerHandle: { peek: () => ({ close: pickerClose }) },
      showError,
      showSuccess,
    })

    shell.showLoading()
    expect(overlay.querySelector('#loading-overlay')).not.toBeNull()

    shell.hideLoading()
    expect(overlay.querySelector('#loading-overlay')).toBeNull()

    shell.showError('bad')
    shell.showSuccess('ok')
    shell.closeTransientOverlays()

    expect(showError).toHaveBeenCalledWith('bad')
    expect(showSuccess).toHaveBeenCalledWith('ok')
    expect(exportClose).toHaveBeenCalledOnce()
    expect(postClose).toHaveBeenCalledOnce()
    expect(pickerClose).toHaveBeenCalledOnce()
  })
})
