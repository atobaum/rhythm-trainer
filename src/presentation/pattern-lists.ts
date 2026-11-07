import { POLYRHYTHM_PRESETS, createPolyrhythmPattern } from '../domain/rhythm/polyrhythm.ts'
import { STRUM_PATTERNS } from '../domain/rhythm/strum-patterns.ts'
import { TWO_HAND_PATTERNS } from '../domain/rhythm/two-hand-patterns.ts'
import type { RhythmPattern } from '../domain/rhythm/pattern.ts'
import { contentPatterns } from '../content/patterns.ts'
import type { PracticeTarget, StoredSettings } from './practice-settings.ts'

export type PatternList = {
  patterns: RhythmPattern[]
  selectedKey: 'patternId' | 'strumPatternId' | 'twoHandPatternId' | 'polyrhythmPatternId'
}

function polyrhythmPatterns(settings: StoredSettings): RhythmPattern[] {
  const presets = POLYRHYTHM_PRESETS.map(([left, right]) => createPolyrhythmPattern(left, right))
  const [left, right] = settings.polyrhythm
  const custom = createPolyrhythmPattern(left, right)
  return presets.some((pattern) => pattern.id === custom.id) ? presets : [...presets, { ...custom, title: `${custom.title} (직접 지정)` }]
}

export function patternListFor(target: Exclude<PracticeTarget, 'stages' | 'songs'>, settings: StoredSettings): PatternList {
  switch (target) {
    case 'strum':
      return { patterns: STRUM_PATTERNS, selectedKey: 'strumPatternId' }
    case 'two-hand':
      return { patterns: TWO_HAND_PATTERNS, selectedKey: 'twoHandPatternId' }
    case 'polyrhythm':
      return { patterns: polyrhythmPatterns(settings), selectedKey: 'polyrhythmPatternId' }
    default:
      return { patterns: contentPatterns, selectedKey: 'patternId' }
  }
}

export function selectedIndex(list: PatternList, settings: StoredSettings): number {
  return Math.max(0, list.patterns.findIndex((pattern) => pattern.id === settings[list.selectedKey]))
}
