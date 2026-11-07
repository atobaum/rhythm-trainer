import type { PracticeMetrics } from '../evaluation/metrics.ts'

type StarRule = {
  stars: number
  minimumHitRate: number
  maximumMeanAbsoluteErrorMs: number
  maximumExtraCount: number
}

const STAR_RULES: StarRule[] = [
  { stars: 5, minimumHitRate: 1, maximumMeanAbsoluteErrorMs: 25, maximumExtraCount: 0 },
  { stars: 4, minimumHitRate: 0.95, maximumMeanAbsoluteErrorMs: 40, maximumExtraCount: 1 },
  { stars: 3, minimumHitRate: 0.9, maximumMeanAbsoluteErrorMs: 60, maximumExtraCount: 1 },
  { stars: 2, minimumHitRate: 0.75, maximumMeanAbsoluteErrorMs: Infinity, maximumExtraCount: 3 },
  { stars: 1, minimumHitRate: 0.5, maximumMeanAbsoluteErrorMs: Infinity, maximumExtraCount: Infinity },
]

// 방향을 반대로 친 스트로크는 칠 곳이 아닌 데를 친 것과 같은 무게로 깎는다.
export function starsFor(metrics: PracticeMetrics): number {
  const meanAbsoluteError = metrics.meanAbsoluteErrorMs ?? Infinity
  const rule = STAR_RULES.find(
    (candidate) =>
      metrics.hitRate >= candidate.minimumHitRate &&
      meanAbsoluteError <= candidate.maximumMeanAbsoluteErrorMs &&
      metrics.extraCount + metrics.directionErrorCount <= candidate.maximumExtraCount,
  )
  return rule?.stars ?? 0
}
