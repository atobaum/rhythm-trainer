import { parsePattern } from '../domain/rhythm/pattern.ts'
import type { RhythmPattern } from '../domain/rhythm/pattern.ts'

const patternModules = import.meta.glob<unknown>('./patterns/*.json', { eager: true, import: 'default' })

export const contentPatterns: RhythmPattern[] = Object.keys(patternModules)
  .sort()
  .map((path) => parsePattern(patternModules[path]))
