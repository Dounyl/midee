import { whenIdle } from '@/lib/whenIdle'

interface RuntimeWarmupOptions {
  preloadDefaultInstrument(): void
}

// Boot-time warmups trade a little background bandwidth for snappier
// first-use interactions without affecting first paint.
export function scheduleRuntimeWarmup(options: RuntimeWarmupOptions): void {
  whenIdle(() => options.preloadDefaultInstrument())
  whenIdle(() => void import('@tonejs/midi'))
  whenIdle(() => {
    void import('@/components/export/ExportModal')
    void import('@/components/export/PostSessionModal')
    void import('@/components/export/MidiPickerModal')
  })
}
