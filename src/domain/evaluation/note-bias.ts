import { compareFractions } from '../rhythm/fraction.ts'
import type { Fraction } from '../rhythm/fraction.ts'
import type { Judgement } from './matcher.ts'

export type NoteBias = {
  patternEventId: string
  onset: Fraction
  meanSignedErrorMs: number | null
  hitCount: number
  missCount: number
}

export function noteBiases(judgements: Judgement[]): NoteBias[] {
  const byNote = new Map<string, { onset: Fraction; errors: number[]; missCount: number }>()
  for (const judgement of judgements) {
    if (judgement.kind === 'extra') {
      continue
    }
    const key = judgement.expected.patternEventId
    const entry = byNote.get(key) ?? { onset: judgement.expected.onset, errors: [], missCount: 0 }
    if (judgement.kind === 'hit') {
      entry.errors.push(judgement.errorMs)
    } else {
      entry.missCount++
    }
    byNote.set(key, entry)
  }
  return [...byNote.entries()]
    .map(([patternEventId, entry]) => ({
      patternEventId,
      onset: entry.onset,
      meanSignedErrorMs:
        entry.errors.length === 0 ? null : entry.errors.reduce((sum, error) => sum + error, 0) / entry.errors.length,
      hitCount: entry.errors.length,
      missCount: entry.missCount,
    }))
    .sort((left, right) => compareFractions(left.onset, right.onset))
}
