import type { GuideMode, PracticeMode } from '../application/practice-types.ts'
import type { DictationKind } from './pages/DictationScreen.tsx'
import type { QuickStrategy } from '../domain/curriculum/quick-curation.ts'

export type PracticeTarget = 'stages' | 'patterns' | 'strum' | 'two-hand' | 'polyrhythm' | 'songs'

export type StoredSettings = {
  target: PracticeTarget
  selectedStageId: string
  patternId: string
  mode: PracticeMode
  bpm: number
  guide: GuideMode
  autoTempo: boolean
  latencyOffsetMs: number
  hideScoreWhileImitating: boolean
  quickMinutes: number
  quickStrategy: QuickStrategy
  exercise: 'tap' | 'dictation'
  dictationKind: DictationKind
  strumPatternId: string
  strumInput: 'tap' | 'split'
  quickIncludeStrum: boolean
  twoHandPatternId: string
  polyrhythm: [number, number]
  polyrhythmPatternId: string
  songId: string
  handFocus: 'both' | 'left' | 'right'
  tapSound: boolean
  tempoRamp: boolean
  guideFade: boolean
}

const STORAGE_KEY = 'rhythm-lab.settings.v1'

export const DEFAULT_SETTINGS: StoredSettings = {
  target: 'stages',
  selectedStageId: '',
  patternId: '',
  mode: 'imitation',
  bpm: 80,
  guide: 'every-beat',
  autoTempo: true,
  latencyOffsetMs: 0,
  hideScoreWhileImitating: false,
  quickMinutes: 5,
  quickStrategy: 'auto',
  exercise: 'tap',
  dictationKind: 'choice',
  strumPatternId: '',
  strumInput: 'split',
  quickIncludeStrum: false,
  twoHandPatternId: '',
  polyrhythm: [2, 3],
  polyrhythmPatternId: '',
  songId: '',
  handFocus: 'both',
  tapSound: true,
  tempoRamp: false,
  guideFade: false,
}

export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const loaded = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StoredSettings>) } : DEFAULT_SETTINGS
    const targets: PracticeTarget[] = ['stages', 'patterns', 'strum', 'two-hand', 'polyrhythm', 'songs']
    return targets.includes(loaded.target) ? loaded : { ...loaded, target: 'stages' }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드 등)에서는 이번 세션에만 유지한다.
  }
}
