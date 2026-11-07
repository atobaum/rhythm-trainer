import type { Judgement } from './matcher.ts'

export type PracticeMetrics = {
  expectedCount: number
  hitCount: number
  missCount: number
  extraCount: number
  directionErrorCount: number
  hitRate: number
  meanAbsoluteErrorMs: number | null
  meanSignedErrorMs: number | null
}

export function computeMetrics(judgements: Judgement[]): PracticeMetrics {
  const errors = judgements.flatMap((judgement) => (judgement.kind === 'hit' ? [judgement.errorMs] : []))
  const missCount = judgements.filter((judgement) => judgement.kind === 'miss').length
  const extraCount = judgements.filter((judgement) => judgement.kind === 'extra').length
  const directionErrorCount = judgements.filter((judgement) => judgement.kind === 'hit' && judgement.wrongDirection).length
  const hitCount = errors.length
  const expectedCount = hitCount + missCount
  const average = (values: number[]) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length)
  return {
    expectedCount,
    hitCount,
    missCount,
    extraCount,
    directionErrorCount,
    hitRate: expectedCount === 0 ? 0 : hitCount / expectedCount,
    meanAbsoluteErrorMs: average(errors.map(Math.abs)),
    meanSignedErrorMs: average(errors),
  }
}
