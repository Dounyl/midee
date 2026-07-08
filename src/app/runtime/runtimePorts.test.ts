import { describe, expect, it, vi } from 'vitest'
import {
  createDisplayPrefsState,
  createPlaybackSessionState,
  createRuntimeNavigationPort,
  createRuntimePortBundle,
  createRuntimeServicesCtx,
  createRuntimeUiPort,
} from '@/app/runtime/runtimePorts'

describe('runtimePorts', () => {
  it('creates runtime services and navigation ports from narrow options', () => {
    const primeInteractiveAudio = vi.fn()
    const navigate = vi.fn()
    const services = createRuntimeServicesCtx({
      services: {
        clock: { kind: 'clock' } as never,
        synth: { kind: 'synth' } as never,
        metronome: { kind: 'metronome' } as never,
        renderer: { kind: 'renderer' } as never,
        input: { kind: 'input' } as never,
        keyboardMode: { kind: 'keyboard-mode' } as never,
      },
      primeInteractiveAudio,
    })
    const navigation = createRuntimeNavigationPort({
      getCurrentTarget: () => ({ kind: 'play' }),
      navigate,
      enterLive: vi.fn(),
    })

    expect(services.clock).toEqual({ kind: 'clock' })
    services.primeInteractiveAudio()
    navigation.navigate({ kind: 'live' })

    expect(primeInteractiveAudio).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith({ kind: 'live' }, undefined)
  })

  it('creates ui, display prefs, and playback session ports with focused forwarding', async () => {
    const firstUi = {
      renderTrackPanel: vi.fn(),
      closeTrackPanel: vi.fn(),
      hideDropzone: vi.fn(),
      showDropzone: vi.fn(),
      setLearnFileName: vi.fn(),
      updateConsoleState: vi.fn(),
      closeConsole: vi.fn(),
      setTheme: vi.fn(),
      setParticle: vi.fn(),
      setChord: vi.fn(),
      setChordVisible: vi.fn(),
      updateChord: vi.fn(),
      chordVisible: false,
      setInstrumentLabel: vi.fn(),
      setCurrentInstrument: vi.fn(),
    }
    const secondUi = {
      renderTrackPanel: vi.fn(),
      closeTrackPanel: vi.fn(),
      hideDropzone: vi.fn(),
      showDropzone: vi.fn(),
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
    }
    const openExportModal = vi.fn(async () => {})
    const closeMidiPicker = vi.fn()
    let currentUi = firstUi
    const port = createRuntimeUiPort({
      getUi: () => currentUi as never,
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      closeTransientOverlays: vi.fn(),
      openExportModal,
      peekExportModal: () => null,
      openPostSession: vi.fn(async () => {}),
      closePostSession: vi.fn(),
      openMidiPicker: vi.fn(async () => {}),
      closeMidiPicker,
    })

    currentUi = secondUi
    await port.openExportModal()
    port.renderTrackPanel({ name: 'demo' } as never)
    expect(openExportModal).toHaveBeenCalledOnce()
    expect(firstUi.renderTrackPanel).not.toHaveBeenCalled()
    expect(secondUi.renderTrackPanel).toHaveBeenCalledWith({ name: 'demo' })
    expect(port.isChordVisible()).toBe(true)

    let baseMidi: unknown = null
    let transposeSemitones = 0
    const displayPrefs = createDisplayPrefsState({
      getBaseMidi: () => baseMidi as never,
      setBaseMidi: (value) => {
        baseMidi = value
      },
      getTransposeSemitones: () => transposeSemitones,
      setTransposeSemitones: (value) => {
        transposeSemitones = value
      },
      getPitchLabelsVisible: () => false,
      setPitchLabelsVisible: vi.fn(),
      getChordOverlayOn: () => true,
      setChordOverlayOn: vi.fn(),
      getThemeIndex: () => 1,
      setThemeIndex: vi.fn(),
      getInstrumentIndex: () => 2,
      setInstrumentIndex: vi.fn(),
      getParticleIndex: () => 3,
      setParticleIndex: vi.fn(),
      saveThemeIndex: vi.fn(),
      saveInstrumentIndex: vi.fn(),
      saveParticleIndex: vi.fn(),
      saveChordOverlay: vi.fn(),
      savePitchLabels: vi.fn(),
    })
    displayPrefs.baseMidi = { id: 'midi' } as never
    displayPrefs.transposeSemitones = 5
    expect(displayPrefs.baseMidi).toEqual({ id: 'midi' })
    expect(displayPrefs.transposeSemitones).toBe(5)

    const store = {
      state: {
        loadedMidi: null,
        status: 'idle',
        currentTime: 1,
        duration: 2,
        volume: 0.5,
        speed: 1,
      },
      hasLoadedFile: false,
      setState: vi.fn(),
      enterPlayLanding: vi.fn(),
      beginPlayLoad: vi.fn(),
      completePlayLoad: vi.fn(),
      replaceLoadedMidi: vi.fn(),
      enterPlay: vi.fn(() => true),
      enterLive: vi.fn(),
    }
    const playbackSession = createPlaybackSessionState({ store: store as never })
    playbackSession.setStatus('playing')
    expect(store.setState).toHaveBeenCalledWith('status', 'playing')
    expect(playbackSession.state.currentTime).toBe(1)
  })

  it('creates a reusable runtime port bundle', () => {
    const bundle = createRuntimePortBundle({
      services: {
        services: {
          clock: { id: 'clock' } as never,
          synth: { id: 'synth' } as never,
          metronome: { id: 'metronome' } as never,
          renderer: { id: 'renderer' } as never,
          input: { id: 'input' } as never,
          keyboardMode: { id: 'keyboard-mode' } as never,
        },
        primeInteractiveAudio: vi.fn(),
      },
      ui: {
        getUi: () =>
          ({
            renderTrackPanel: vi.fn(),
            closeTrackPanel: vi.fn(),
            hideDropzone: vi.fn(),
            showDropzone: vi.fn(),
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
        showLoading: vi.fn(),
        hideLoading: vi.fn(),
        showError: vi.fn(),
        showSuccess: vi.fn(),
        closeTransientOverlays: vi.fn(),
        openExportModal: vi.fn(async () => {}),
        peekExportModal: () => null,
        openPostSession: vi.fn(async () => {}),
        closePostSession: vi.fn(),
        openMidiPicker: vi.fn(async () => {}),
        closeMidiPicker: vi.fn(),
      },
      navigation: {
        getCurrentTarget: () => ({ kind: 'play' }),
        navigate: vi.fn(),
        enterLive: vi.fn(),
      },
    })

    expect(bundle.services.clock).toEqual({ id: 'clock' })
    expect(bundle.navigation.getCurrentTarget()).toEqual({ kind: 'play' })
    expect(bundle.ui.isChordVisible()).toBe(true)
  })
})
