import type { PracticeMetrics } from '../evaluation/metrics.ts'
import { DEFAULT_TEMPO_POLICY } from './auto-tempo.ts'

export const CLEAN_REPETITIONS_AFTER_MISS = 2
const MAXIMUM_CLEAN_ERROR_MS = 60
const QUICK_PASS_REPETITIONS = 3
const STRUGGLE_REPETITIONS = 8

export function isCleanRepetition(metrics: PracticeMetrics): boolean {
  return (
    metrics.missCount === 0 &&
    metrics.extraCount === 0 &&
    metrics.directionErrorCount === 0 &&
    metrics.meanAbsoluteErrorMs !== null &&
    metrics.meanAbsoluteErrorMs <= MAXIMUM_CLEAN_ERROR_MS
  )
}

export function trailingCleanCount(cleanByRepetition: boolean[]): number {
  let count = 0
  for (let index = cleanByRepetition.length - 1; index >= 0 && cleanByRepetition[index]; index--) {
    count++
  }
  return count
}

// 처음에 바로 깔끔하면 통과하고, 한 번이라도 틀렸으면 연속으로 더 깔끔하게 쳐야 통과한다.
export function cleanRepetitionsNeeded(cleanByRepetition: boolean[]): number {
  return cleanByRepetition.some((clean) => !clean) ? CLEAN_REPETITIONS_AFTER_MISS : 1
}

export function loopPassed(cleanByRepetition: boolean[]): boolean {
  return cleanByRepetition.length > 0 && trailingCleanCount(cleanByRepetition) >= cleanRepetitionsNeeded(cleanByRepetition)
}

export function tempoAfterLoop(bpm: number, repetitionsToPass: number | null): { bpm: number; change: number } {
  const { stepBpm, minimumBpm, maximumBpm } = DEFAULT_TEMPO_POLICY
  let target = bpm
  if (repetitionsToPass === null || repetitionsToPass > STRUGGLE_REPETITIONS) {
    target = bpm - stepBpm
  } else if (repetitionsToPass <= QUICK_PASS_REPETITIONS) {
    target = bpm + stepBpm
  }
  const clamped = Math.min(maximumBpm, Math.max(minimumBpm, target))
  return { bpm: clamped, change: clamped - bpm }
}
