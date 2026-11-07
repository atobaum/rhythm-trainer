import type { Judgement } from './matcher.ts'
import { computeMetrics } from './metrics.ts'
import type { PracticeMetrics } from './metrics.ts'

export function metricsByTrack(judgements: Judgement[], trackIds: string[]): Map<string, PracticeMetrics> {
  const trackOf = (judgement: Judgement) => (judgement.kind === 'extra' ? judgement.tap.trackId : judgement.expected.trackId)
  return new Map(trackIds.map((trackId) => [trackId, computeMetrics(judgements.filter((judgement) => trackOf(judgement) === trackId))]))
}

export type Synchrony = {
  pairCount: number
  meanGapMs: number | null
}

// 두 손이 같은 시점에 쳐야 하는 음표에서 실제 두 탭 사이 간격. 둘 다 같은 만큼 늦어도 간격은 작다.
export function handSynchrony(judgements: Judgement[]): Synchrony {
  const hitsByMoment = new Map<string, number[]>()
  for (const judgement of judgements) {
    if (judgement.kind !== 'hit') {
      continue
    }
    const { onset, repetition } = judgement.expected
    const key = `${repetition}:${onset.numerator}/${onset.denominator}`
    hitsByMoment.set(key, [...(hitsByMoment.get(key) ?? []), judgement.tap.timeMs])
  }
  const gaps = [...hitsByMoment.values()].filter((times) => times.length === 2).map(([first, second]) => Math.abs(first - second))
  return {
    pairCount: gaps.length,
    meanGapMs: gaps.length === 0 ? null : gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length,
  }
}
