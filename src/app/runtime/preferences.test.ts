import { afterEach, describe, expect, it } from 'vitest'
import { createAppPreferences } from '@/app/runtime/preferences'

describe('createAppPreferences', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('hydrates the default values when no preference is stored', () => {
    const prefs = createAppPreferences()
    expect(prefs.hydrate()).toMatchObject({
      metronomeBpm: 120,
      chordOverlay: true,
      pitchLabels: false,
      keyboardMode61: false,
      skipHomeIntro: false,
    })
  })

  it('hydrates persisted values from localStorage', () => {
    const prefs = createAppPreferences()
    prefs.stores.themeIndex.save(1)
    prefs.stores.instrumentIndex.save(2)
    prefs.stores.particleIndex.save(1)
    prefs.stores.metronomeBpm.save(144)
    prefs.stores.chordOverlay.save(false)
    prefs.stores.pitchLabels.save(true)
    prefs.stores.keyboardMode61.save(true)
    prefs.stores.skipHomeIntro.save(true)

    expect(prefs.hydrate()).toMatchObject({
      themeIndex: 1,
      instrumentIndex: 2,
      particleIndex: 1,
      metronomeBpm: 144,
      chordOverlay: false,
      pitchLabels: true,
      keyboardMode61: true,
      skipHomeIntro: true,
    })
  })

  it('falls back to defaults when persisted values are malformed', () => {
    localStorage.setItem('midee.metronomeBpm', 'oops')
    localStorage.setItem('midee.chordOverlay', 'not-a-bool')
    localStorage.setItem('midee.themeIndex', '9999')

    const prefs = createAppPreferences()
    expect(prefs.hydrate()).toMatchObject({
      metronomeBpm: 120,
      chordOverlay: false,
      themeIndex: 3,
    })
  })
})
