import { DEFAULT_WINDOWS, matchEvents } from '../domain/evaluation/matcher.ts'
import type { Judgement, Tap } from '../domain/evaluation/matcher.ts'
import { computeMetrics } from '../domain/evaluation/metrics.ts'
import type { PracticeMetrics } from '../domain/evaluation/metrics.ts'
import { isCleanRepetition } from '../domain/practice/loop-progress.ts'
import type { ExpectedEvent } from '../domain/rhythm/event-generator.ts'
import type { LoopPlan } from './loop-plan.ts'

export type RepetitionResult = {
  repetition: number
  judgements: Judgement[]
  metrics: PracticeMetrics
  clean: boolean
}

export function absoluteExpected(plan: LoopPlan, originMs: number, repetition: number): ExpectedEvent[] {
  return plan
    .expectedForRepetition(repetition)
    .map((event) => ({ ...event, targetTimeMs: originMs + event.targetTimeMs }))
}

// 각 반복의 시작보다 good 범위만큼 앞선 탭까지 그 반복에 넣어야, 첫 박을 일찍 친 탭이 앞 반복의 Extra 가 되지 않는다.
export function repetitionOfTime(plan: LoopPlan, originMs: number, timeMs: number): number {
  return Math.floor((timeMs - originMs - plan.performStartMs + DEFAULT_WINDOWS.goodMs) / plan.patternMs)
}

export function evaluateRepetitions(plan: LoopPlan, originMs: number, taps: Tap[], completedRepetitions: number): RepetitionResult[] {
  if (completedRepetitions <= 0) {
    return []
  }
  const expected = Array.from({ length: completedRepetitions }, (_, repetition) =>
    absoluteExpected(plan, originMs, repetition),
  ).flat()
  const lastIncluded = completedRepetitions - 1
  const relevantTaps = taps.filter((candidate) => repetitionOfTime(plan, originMs, candidate.timeMs) <= lastIncluded)
  const judgements = matchEvents(expected, relevantTaps)

  return Array.from({ length: completedRepetitions }, (_, repetition) => {
    const own = judgements.filter((judgement) =>
      judgement.kind === 'extra'
        ? repetitionOfTime(plan, originMs, judgement.tap.timeMs) === repetition
        : judgement.expected.repetition === repetition,
    )
    const metrics = computeMetrics(own)
    return { repetition, judgements: own, metrics, clean: isCleanRepetition(metrics) }
  })
}
