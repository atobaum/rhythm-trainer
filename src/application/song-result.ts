import type { Judgement, Tap } from '../domain/evaluation/matcher.ts'
import type { ExpectedEvent } from '../domain/rhythm/event-generator.ts'
import { addFractions, createFraction, multiplyFractions } from '../domain/rhythm/fraction.ts'
import type { Fraction } from '../domain/rhythm/fraction.ts'

function shiftJudgement(judgement: Judgement, offsetMs: number, onsetOffset: Fraction): Judgement {
  const shiftTap = (tap: Tap): Tap => ({ ...tap, timeMs: tap.timeMs + offsetMs })
  const shiftExpected = (expected: ExpectedEvent): ExpectedEvent => ({
    ...expected,
    targetTimeMs: expected.targetTimeMs + offsetMs,
    onset: addFractions(expected.onset, onsetOffset),
  })
  switch (judgement.kind) {
    case 'hit':
      return { ...judgement, expected: shiftExpected(judgement.expected), tap: shiftTap(judgement.tap) }
    case 'miss':
      return { ...judgement, expected: shiftExpected(judgement.expected) }
    default:
      return { ...judgement, tap: shiftTap(judgement.tap) }
  }
}

// 칸 처음을 0 으로 둔 시각으로 판정을 옮긴다. 세션을 다시 시작해도 단위끼리 이어 붙일 수 있게 한다.
export function judgementsFromUnitStart(judgements: Judgement[], unitStartMs: number): Judgement[] {
  return judgements.map((judgement) => shiftJudgement(judgement, -unitStartMs, createFraction(0, 1)))
}

// 단위마다 따로 판정한 결과를 곡 처음부터의 시각과 위치로 이어 붙인다. 오차는 탭과 목표를 같이 옮기므로 바뀌지 않는다.
export function joinUnitJudgements(unitJudgements: (Judgement[] | null)[], unitMs: number, unitLength: Fraction): Judgement[] {
  return unitJudgements.flatMap((judgements, unit) =>
    (judgements ?? []).map((judgement) => shiftJudgement(judgement, unit * unitMs, multiplyFractions(createFraction(unit, 1), unitLength))),
  )
}
