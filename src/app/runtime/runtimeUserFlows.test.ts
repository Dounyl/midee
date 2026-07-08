import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectRuntimeMidi, openRuntimeFilePicker } from '@/app/runtime/runtimeUserFlows'

const trackMock = vi.fn()
const tMock = vi.fn((key: string) => key)

vi.mock('@/services/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => tMock(key),
}))

describe('runtimeUserFlows', () => {
  beforeEach(() => {
    trackMock.mockReset()
    tMock.mockClear()
  })

  it('connectRuntimeMidi primes audio and reports blocked permission errors', async () => {
    const primeInteractiveAudio = vi.fn()
    const showError = vi.fn()
    const requestAccess = vi.fn(async () => false)
    const midiInput = {
      status: { value: 'blocked' as const },
      requestAccess,
    }

    await connectRuntimeMidi({
      midiInput,
      primeInteractiveAudio,
      showError,
    })

    expect(primeInteractiveAudio).toHaveBeenCalledOnce()
    expect(requestAccess).toHaveBeenCalledOnce()
    expect(trackMock).toHaveBeenCalledWith('midi_permission_requested', { was_blocked: true })
    expect(trackMock).toHaveBeenCalledWith('midi_permission_denied', { was_blocked: true })
    expect(showError).toHaveBeenCalledWith('error.midi.permissionBlocked')
  })

  it('connectRuntimeMidi tracks granted permissions without showing errors', async () => {
    const showError = vi.fn()

    await connectRuntimeMidi({
      midiInput: {
        status: { value: 'disconnected' as const },
        requestAccess: vi.fn(async () => true),
      },
      primeInteractiveAudio: vi.fn(),
      showError,
    })

    expect(trackMock).toHaveBeenCalledWith('midi_permission_requested', { was_blocked: false })
    expect(trackMock).toHaveBeenCalledWith('midi_permission_granted')
    expect(showError).not.toHaveBeenCalled()
  })

  it('openRuntimeFilePicker resolves routing on modal callbacks', async () => {
    const opened: {
      current: {
        onFile: (file: File) => void
        onSamplePlay: (id: string) => void
        onSamplePractice: (id: string) => void
      } | null
    } = { current: null }

    const openFile = vi.fn(async () => {})
    const openSample = vi.fn(async () => {})
    const enterLearnRequest = vi.fn(async () => {})

    openRuntimeFilePicker({
      target: undefined,
      getCurrentRouteTarget: () => ({ kind: 'exercise', routeId: 'play-along' }) as never,
      getMidiPickerModal: async () => ({
        open: (options) => {
          opened.current = options
        },
      }),
      midiFlow: {
        openFile,
        openSample,
      },
      appController: {
        enterLearnRequest,
      },
    })

    await Promise.resolve()
    const file = new File(['midi'], 'demo.mid')
    opened.current?.onFile(file)
    opened.current?.onSamplePlay('sample-a')
    opened.current?.onSamplePractice('sample-b')

    expect(openFile).toHaveBeenCalledWith(file, 'picker', 'learn')
    expect(openSample).toHaveBeenCalledWith('sample-a', 'play')
    expect(enterLearnRequest).toHaveBeenCalledWith({ kind: 'sample', sampleId: 'sample-b' })
  })
})
