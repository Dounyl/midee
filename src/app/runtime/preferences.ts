import { booleanPersisted, indexPersisted, numberPersisted } from '@/lib/persistence'
import { PARTICLE_STYLES } from '@/services/renderer/ParticleSystem'
import { THEMES } from '@/services/renderer/theme'
import { SKIP_HOME_INTRO_STORAGE_KEY } from '@/stores/app/state'

export interface AppPreferenceStores {
  themeIndex: { load(): number; save(value: number): void }
  instrumentIndex: { load(): number; save(value: number): void }
  particleIndex: { load(): number; save(value: number): void }
  metronomeBpm: { load(): number; save(value: number): void }
  chordOverlay: { load(): boolean; save(value: boolean): void }
  pitchLabels: { load(): boolean; save(value: boolean): void }
  keyboardMode61: { load(): boolean; save(value: boolean): void }
  skipHomeIntro: { load(): boolean; save(value: boolean): void }
}

export interface HydratedAppPreferences {
  themeIndex: number
  instrumentIndex: number
  particleIndex: number
  metronomeBpm: number
  chordOverlay: boolean
  pitchLabels: boolean
  keyboardMode61: boolean
  skipHomeIntro: boolean
}

export function createAppPreferences(): {
  stores: AppPreferenceStores
  hydrate(): HydratedAppPreferences
} {
  const instrumentIds = [
    'piano',
    'upright',
    'digital',
    'rhodes',
    'guitar',
    'violin',
    'flute',
    'pad',
    'pluck',
    'strings',
    'bass',
    'bells',
    'marimba',
  ] as const

  const stores: AppPreferenceStores = {
    themeIndex: indexPersisted(
      'midee.themeIndex',
      Math.max(
        0,
        THEMES.findIndex((t) => t.name === 'Sunset'),
      ),
      THEMES.length,
    ),
    instrumentIndex: indexPersisted(
      'midee.instrumentIndex',
      Math.max(0, instrumentIds.indexOf('upright')),
      instrumentIds.length,
    ),
    particleIndex: indexPersisted(
      'midee.particleIndex',
      Math.max(
        0,
        PARTICLE_STYLES.findIndex((s) => s.id === 'embers'),
      ),
      PARTICLE_STYLES.length,
    ),
    metronomeBpm: numberPersisted('midee.metronomeBpm', 120, 40, 240),
    chordOverlay: booleanPersisted('midee.chordOverlay', true),
    pitchLabels: booleanPersisted('midee.pitchLabels', false),
    keyboardMode61: booleanPersisted('midee.keyboardMode61', false),
    skipHomeIntro: booleanPersisted(SKIP_HOME_INTRO_STORAGE_KEY, false),
  }

  return {
    stores,
    hydrate() {
      return {
        themeIndex: stores.themeIndex.load(),
        instrumentIndex: stores.instrumentIndex.load(),
        particleIndex: stores.particleIndex.load(),
        metronomeBpm: stores.metronomeBpm.load(),
        chordOverlay: stores.chordOverlay.load(),
        pitchLabels: stores.pitchLabels.load(),
        keyboardMode61: stores.keyboardMode61.load(),
        skipHomeIntro: stores.skipHomeIntro.load(),
      }
    },
  }
}
