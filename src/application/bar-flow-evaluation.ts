import { DEFAULT_WINDOWS, matchEvents } from '../domain/evaluation/matcher.ts'
import type { Judgement, Tap } from '../domain/evaluation/matcher.ts'
import { computeMetrics } from '../domain/evaluation/metrics.ts'
import type { PracticeMetrics } from '../domain/evaluation/metrics.ts'
import { isCleanRepetition } from '../domain/practice/loop-progress.ts'
import type { ExpectedEvent } from '../domain/rhythm/event-generator.ts'

export type SlotVerdict = 'pending' | 'retry' | 'clean'

export type SlotEvaluation = {
  verdict: SlotVerdict
  judgements: Judgement[]
  metrics: PracticeMetrics
}

export type SlotWindow = {
  startMs: number
  decisionMs: number
}

// 칸 시작보다 good 범위만큼 앞선 탭부터 다음 칸 시작 good 범위 전까지가 그 칸의 탭이다.
export function tapsInSlot(taps: Tap[], window: SlotWindow): Tap[] {
  return taps.filter((tap) => tap.timeMs >= window.startMs - DEFAULT_WINDOWS.goodMs && tap.timeMs < window.decisionMs)
}

function hasMistake(judgements: Judgement[]): boolean {
  return judgements.some((judgement) => judgement.kind !== 'hit' || judgement.wrongDirection)
}

// 틀린 것은 그 순간 정하고, 깔끔한지는 칸 경계에서 평균 오차까지 보고 정한다.
export function evaluateSlot(expected: ExpectedEvent[], taps: Tap[], window: SlotWindow, nowMs: number): SlotEvaluation {
  const own = tapsInSlot(taps, window).filter((tap) => tap.timeMs <= nowMs)
  if (nowMs >= window.decisionMs) {
    const judgements = matchEvents(expected, own)
    const metrics = computeMetrics(judgements)
    return { verdict: isCleanRepetition(metrics) ? 'clean' : 'retry', judgements, metrics }
  }
  const due = expected.filter((event) => event.targetTimeMs <= nowMs + DEFAULT_WINDOWS.goodMs)
  const judgements = matchEvents(due, own).filter(
    (judgement) => judgement.kind !== 'miss' || judgement.expected.targetTimeMs < nowMs - DEFAULT_WINDOWS.goodMs,
  )
  return { verdict: hasMistake(judgements) ? 'retry' : 'pending', judgements, metrics: computeMetrics(judgements) }
}
