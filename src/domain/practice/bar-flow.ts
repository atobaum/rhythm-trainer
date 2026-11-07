import { DEFAULT_TEMPO_POLICY } from './auto-tempo.ts'
import { loopPassed } from './loop-progress.ts'

export type BarOutcome = 'clean' | 'retry' | 'skip'

export type BarFlow = {
  barCount: number
  index: number
  attempts: number[]
  skipped: boolean[]
  cleanHere: boolean[]
  finished: boolean
  continuous: boolean
}

const QUICK_STAGE_ATTEMPTS = 1.5
const TEMPO_UP_ATTEMPTS = 1.3
const TEMPO_DOWN_ATTEMPTS = 3
const SLOW_STAGE_SCORE = 0.6
export const REVIEW_BAR_ATTEMPTS = 3

// continuous 면 결과와 상관없이 다음 단위로 넘어가 끝까지 한 번에 친다.
export function createBarFlow(barCount: number, continuous = false): BarFlow {
  return {
    barCount,
    index: 0,
    attempts: new Array(barCount).fill(0),
    skipped: new Array(barCount).fill(false),
    cleanHere: [],
    finished: false,
    continuous,
  }
}

export function recordBar(flow: BarFlow, outcome: BarOutcome): BarFlow {
  if (flow.finished) {
    return flow
  }
  const attempts = flow.attempts.map((count, index) => (index === flow.index ? count + 1 : count))
  const skipped = flow.skipped.map((value, index) => (index === flow.index ? value || outcome === 'skip' : value))
  const cleanHere = outcome === 'skip' ? [] : [...flow.cleanHere, outcome === 'clean']
  const advance = flow.continuous || outcome === 'skip' || loopPassed(cleanHere)
  const index = advance ? flow.index + 1 : flow.index
  return {
    ...flow,
    attempts,
    skipped,
    cleanHere: advance ? [] : cleanHere,
    index: Math.min(index, flow.barCount - 1),
    finished: advance && index >= flow.barCount,
  }
}

export function stageClearedBy(flow: BarFlow): boolean {
  return flow.finished && flow.skipped.every((value) => !value)
}

export function averageAttempts(flow: BarFlow): number {
  const played = flow.attempts.filter((count) => count > 0)
  return played.length === 0 ? 0 : played.reduce((sum, count) => sum + count, 0) / played.length
}

export function stageSkillScore(flow: BarFlow): number {
  if (!stageClearedBy(flow)) {
    return 0
  }
  return averageAttempts(flow) <= QUICK_STAGE_ATTEMPTS ? 1 : SLOW_STAGE_SCORE
}

export function tempoAfterStage(bpm: number, flow: BarFlow): { bpm: number; change: number } {
  const { stepBpm, minimumBpm, maximumBpm } = DEFAULT_TEMPO_POLICY
  const average = averageAttempts(flow)
  let target = bpm
  if (stageClearedBy(flow) && average <= TEMPO_UP_ATTEMPTS) {
    target = bpm + stepBpm
  } else if (!stageClearedBy(flow) || average > TEMPO_DOWN_ATTEMPTS) {
    target = bpm - stepBpm
  }
  const clamped = Math.min(maximumBpm, Math.max(minimumBpm, target))
  return { bpm: clamped, change: clamped - bpm }
}
