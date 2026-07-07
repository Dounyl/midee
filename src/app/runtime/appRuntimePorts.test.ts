import { describe, expect, it, vi } from 'vitest'
import {
  createAppRuntimePortBundle,
  createAppRuntimePortBundleOptions,
} from '@/app/runtime/appRuntimePorts'

describe('createAppRuntimePortBundleOptions', () => {
  it('builds shared runtime port bundle options from narrow dependencies', async () => {
    const options = createAppRuntimePortBundleOptions({
      services: {
        clock: { id: 'clock' } as never,
        synth: { id: 'synth' } as never,
        metronome: { id: 'metronome' } as never,
        renderer: { id: 'renderer' } as never,
        input: { id: 'input' } as never,
        keyboardMode: { id: 'keyboardMode' } as never,
      },
      primeInteractiveAudio: vi.fn(),
      getUi: vi.fn(() => ({ id: 'ui' }) as never),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      closeTransientOverlays: vi.fn(),
      openExportModal: vi.fn(async () => {}),
      peekExportModal: vi.fn(() => null),
      openPostSession: vi.fn(async () => {}),
      closePostSession: vi.fn(),
      openMidiPicker: vi.fn(async () => {}),
      closeMidiPicker: vi.fn(),
      getCurrentTarget: vi.fn(() => ({ kind: 'play' }) as never),
      navigate: vi.fn(),
      enterLive: vi.fn(),
    })

    expect(options.services.services.clock).toEqual({ id: 'clock' })
    await options.ui.openExportModal()
    options.navigation.enterLive(false)

    expect(options.navigation.getCurrentTarget()).toEqual({ kind: 'play' })
  })

  it('creates the runtime port bundle directly from the same narrow dependencies', async () => {
    const bundle = createAppRuntimePortBundle({
      services: {
        clock: { id: 'clock' } as never,
        synth: { id: 'synth' } as never,
        metronome: { id: 'metronome' } as never,
        renderer: { id: 'renderer' } as never,
        input: { id: 'input' } as never,
        keyboardMode: { id: 'keyboardMode' } as never,
      },
      primeInteractiveAudio: vi.fn(),
      getUi: vi.fn(
        () =>
          ({
            hideDropzone: vi.fn(),
            showDropzone: vi.fn(),
            renderTrackPanel: vi.fn(),
            closeTrackPanel: vi.fn(),
            setLearnFileName: vi.fn(),
            updateConsoleState: vi.fn(),
            closeConsole: vi.fn(),
            setTheme: vi.fn(),
            setParticle: vi.fn(),
            setChord: vi.fn(),
            setChordVisible: vi.fn(),
            updateChord: vi.fn(),
            chordVisible: true,
            setInstrumentLabel: vi.fn(),
            setCurrentInstrument: vi.fn(),
          }) as never,
      ),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      closeTransientOverlays: vi.fn(),
      openExportModal: vi.fn(async () => {}),
      peekExportModal: vi.fn(() => null),
      openPostSession: vi.fn(async () => {}),
      closePostSession: vi.fn(),
      openMidiPicker: vi.fn(async () => {}),
      closeMidiPicker: vi.fn(),
      getCurrentTarget: vi.fn(() => ({ kind: 'play' }) as never),
      navigate: vi.fn(),
      enterLive: vi.fn(),
    })

    await bundle.ui.openExportModal()
    bundle.navigation.enterLive()

    expect(bundle.services.clock).toEqual({ id: 'clock' })
    expect(bundle.navigation.getCurrentTarget()).toEqual({ kind: 'play' })
  })
})
