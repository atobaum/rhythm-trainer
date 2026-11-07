import type { ExpectedEvent } from '../rhythm/event-generator.ts'
import type { StrumDirection } from '../rhythm/pattern.ts'

export type Tap = {
  id: string
  timeMs: number
  trackId: string
  direction?: StrumDirection
}

export type Grade = 'perfect' | 'great' | 'good'

export type Judgement =
  | { kind: 'hit'; expected: ExpectedEvent; tap: Tap; errorMs: number; grade: Grade; wrongDirection: boolean }
  | { kind: 'miss'; expected: ExpectedEvent }
  | { kind: 'extra'; tap: Tap }

export type JudgementWindows = {
  perfectMs: number
  greatMs: number
  goodMs: number
}

export const DEFAULT_WINDOWS: JudgementWindows = { perfectMs: 30, greatMs: 70, goodMs: 120 }

const MISS_COST = 1
const EXTRA_COST = 1

export function classifyError(errorMs: number, windows: JudgementWindows = DEFAULT_WINDOWS): Grade {
  const absolute = Math.abs(errorMs)
  if (absolute <= windows.perfectMs) {
    return 'perfect'
  }
  return absolute <= windows.greatMs ? 'great' : 'good'
}

type Step = 'match' | 'miss' | 'extra'

// 방향 없이 친 탭(일반 탭 모드)은 방향을 따지지 않는다. 방향은 타이밍 매칭과 따로 센다.
function isWrongDirection(expected: ExpectedEvent, tap: Tap): boolean {
  return expected.direction !== undefined && tap.direction !== undefined && expected.direction !== tap.direction
}

function alignTrack(targets: ExpectedEvent[], trackTaps: Tap[], windows: JudgementWindows): Judgement[] {
  const rows = targets.length + 1
  const columns = trackTaps.length + 1
  const cost: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(Infinity))
  const step: Step[][] = Array.from({ length: rows }, () => new Array<Step>(columns).fill('match'))
  cost[0][0] = 0

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      if (i === 0 && j === 0) {
        continue
      }
      const candidates: [number, Step][] = []
      if (i > 0) {
        candidates.push([cost[i - 1][j] + MISS_COST, 'miss'])
      }
      if (j > 0) {
        candidates.push([cost[i][j - 1] + EXTRA_COST, 'extra'])
      }
      if (i > 0 && j > 0) {
        const distance = Math.abs(trackTaps[j - 1].timeMs - targets[i - 1].targetTimeMs)
        if (distance <= windows.goodMs) {
          candidates.push([cost[i - 1][j - 1] + distance / windows.goodMs, 'match'])
        }
      }
      for (const [candidateCost, candidateStep] of candidates) {
        if (candidateCost < cost[i][j]) {
          cost[i][j] = candidateCost
          step[i][j] = candidateStep
        }
      }
    }
  }

  const judgements: Judgement[] = []
  let i = targets.length
  let j = trackTaps.length
  while (i > 0 || j > 0) {
    const chosen = step[i][j]
    if (chosen === 'match') {
      const errorMs = trackTaps[j - 1].timeMs - targets[i - 1].targetTimeMs
      judgements.push({
        kind: 'hit',
        expected: targets[i - 1],
        tap: trackTaps[j - 1],
        errorMs,
        grade: classifyError(errorMs, windows),
        wrongDirection: isWrongDirection(targets[i - 1], trackTaps[j - 1]),
      })
      i--
      j--
    } else if (chosen === 'miss') {
      judgements.push({ kind: 'miss', expected: targets[i - 1] })
      i--
    } else {
      judgements.push({ kind: 'extra', tap: trackTaps[j - 1] })
      j--
    }
  }
  return judgements.reverse()
}

export function judgementTimeMs(judgement: Judgement): number {
  return judgement.kind === 'extra' ? judgement.tap.timeMs : judgement.expected.targetTimeMs
}

export function matchEvents(
  expectedEvents: ExpectedEvent[],
  taps: Tap[],
  windows: JudgementWindows = DEFAULT_WINDOWS,
): Judgement[] {
  const trackIds = new Set(expectedEvents.map((event) => event.trackId))
  const judgements: Judgement[] = []
  for (const trackId of trackIds) {
    const targets = expectedEvents
      .filter((event) => event.trackId === trackId)
      .sort((left, right) => left.targetTimeMs - right.targetTimeMs)
    const trackTaps = taps.filter((tap) => tap.trackId === trackId).sort((left, right) => left.timeMs - right.timeMs)
    judgements.push(...alignTrack(targets, trackTaps, windows))
  }
  for (const tap of taps) {
    if (!trackIds.has(tap.trackId)) {
      judgements.push({ kind: 'extra', tap })
    }
  }
  return judgements.sort((left, right) => judgementTimeMs(left) - judgementTimeMs(right))
}
