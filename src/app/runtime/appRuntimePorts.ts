import {
  type CreateRuntimePortBundleOptions,
  createRuntimePortBundle,
} from '@/app/runtime/runtimePorts'

export interface CreateAppRuntimePortBundleOptions {
  services: CreateRuntimePortBundleOptions['services']['services']
  primeInteractiveAudio(): void
  getUi: CreateRuntimePortBundleOptions['ui']['getUi']
  showLoading(): void
  hideLoading(): void
  showError(message: string): void
  showSuccess(message: string): void
  closeTransientOverlays(): void
  openExportModal(): Promise<void>
  peekExportModal: CreateRuntimePortBundleOptions['ui']['peekExportModal']
  openPostSession(duration: number, noteCount: number): Promise<void>
  closePostSession(): void
  openMidiPicker: CreateRuntimePortBundleOptions['ui']['openMidiPicker']
  closeMidiPicker(): void
  getCurrentTarget: CreateRuntimePortBundleOptions['navigation']['getCurrentTarget']
  navigate: CreateRuntimePortBundleOptions['navigation']['navigate']
  enterLive: CreateRuntimePortBundleOptions['navigation']['enterLive']
}

export function createAppRuntimePortBundleOptions(
  options: CreateAppRuntimePortBundleOptions,
): CreateRuntimePortBundleOptions {
  return {
    services: {
      services: options.services,
      primeInteractiveAudio: () => options.primeInteractiveAudio(),
    },
    ui: {
      getUi: options.getUi,
      showLoading: () => options.showLoading(),
      hideLoading: () => options.hideLoading(),
      showError: (message) => options.showError(message),
      showSuccess: (message) => options.showSuccess(message),
      closeTransientOverlays: () => options.closeTransientOverlays(),
      openExportModal: () => options.openExportModal(),
      peekExportModal: () => options.peekExportModal(),
      openPostSession: (duration, noteCount) => options.openPostSession(duration, noteCount),
      closePostSession: () => options.closePostSession(),
      openMidiPicker: (openOptions) => options.openMidiPicker(openOptions),
      closeMidiPicker: () => options.closeMidiPicker(),
    },
    navigation: {
      getCurrentTarget: () => options.getCurrentTarget(),
      navigate: (target, navigateOptions) => options.navigate(target, navigateOptions),
      enterLive: (primeAudio) => options.enterLive(primeAudio),
    },
  }
}

export function createAppRuntimePortBundle(options: CreateAppRuntimePortBundleOptions) {
  return createRuntimePortBundle(createAppRuntimePortBundleOptions(options))
}
