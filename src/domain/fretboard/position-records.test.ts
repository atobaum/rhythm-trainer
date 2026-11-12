import { describe, expect, it } from 'vitest'
import { frequencyAt, pitchClassAt } from './fretboard.ts'
import type { FretRange } from './fretboard.ts'
import { addSession, attemptWeight, cellTone, emptyPositionRecords, questionWeightFrom, recordKey, recordKeyAt } from './position-records.ts'
import type { RecentAttempt } from './position-records.ts'
import { nextQuestion, sameQuestion } from './questions.ts'
import type { FretboardQuestion } from './questions.ts'
import type { AnsweredQuestion } from './session-result.ts'

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

function attempts(...entries: [boolean, number][]): RecentAttempt[] {
  return entries.map(([correct, responseMs]) => ({ correct, responseMs }))
}

describe('위치의 음높이', () => {
  it('6번줄 5프렛은 A2 110Hz, 1번줄 개방현은 E4 약 329.6Hz 다', () => {
    expect(frequencyAt({ stringNumber: 6, fret: 5 })).toBeCloseTo(110, 6)
    expect(frequencyAt({ stringNumber: 1, fret: 0 })).toBeCloseTo(329.63, 2)
    expect(frequencyAt({ stringNumber: 5, fret: 0 })).toBeCloseTo(110, 6)
  })
})

describe('위치별 기록', () => {
  const question: FretboardQuestion = { mode: 'name-the-note', position: { stringNumber: 3, fret: 2 } }

  it('최근 5번만 남긴다', () => {
    const answers: AnsweredQuestion[] = Array.from({ length: 7 }, (_, index) => ({
      question,
      answer: { mode: 'name-the-note', pitchClass: index < 2 ? 0 : 9 },
      responseMs: 1000 + index,
    }))
    const records = addSession(emptyPositionRecords(), 'name-the-note', answers)
    expect(records['name-the-note'][recordKey(question)]).toEqual(
      [1002, 1003, 1004, 1005, 1006].map((responseMs) => ({ correct: true, responseMs })),
    )
    expect(records['find-the-position']).toEqual({})
  })

  it('음 보고 위치 찍기는 줄과 음으로 묶어 12프렛 위아래가 같은 기록이다', () => {
    expect(recordKeyAt('find-the-position', { stringNumber: 6, fret: 0 })).toBe(
      recordKeyAt('find-the-position', { stringNumber: 6, fret: 12 }),
    )
    expect(recordKeyAt('name-the-note', { stringNumber: 6, fret: 0 })).not.toBe(recordKeyAt('name-the-note', { stringNumber: 6, fret: 12 }))
    expect(recordKeyAt('find-the-position', { stringNumber: 6, fret: 5 })).toBe(
      recordKey({ mode: 'find-the-position', stringNumber: 6, pitchClass: 9 }),
    )
  })

  it('가중치는 1 + 2 × 오답 + 3초 넘은 정답, 기록이 없으면 3 이다', () => {
    expect(attemptWeight(undefined)).toBe(3)
    expect(attemptWeight(attempts([true, 1000]))).toBe(1)
    expect(attemptWeight(attempts([false, 1000], [true, 3001], [true, 3000]))).toBe(4)
  })

  it('칸 상태는 오답 2번 이상 빨강, 모두 정답이고 평균 3초 이하 초록, 나머지 노랑이다', () => {
    expect(cellTone(undefined)).toBeNull()
    expect(cellTone(attempts([true, 3000], [true, 3000]))).toBe('strong')
    expect(cellTone(attempts([true, 2000], [true, 4001]))).toBe('shaky')
    expect(cellTone(attempts([false, 1000], [true, 1000]))).toBe('shaky')
    expect(cellTone(attempts([false, 1000], [false, 1000], [true, 1000]))).toBe('weak')
  })
})

describe('가중 출제', () => {
  it('한 위치만 오답 5번이면 고르게 뽑을 때보다 자주 나오고 연속 같은 문제는 없다', () => {
    const range: FretRange = { strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12 }
    const weak: FretboardQuestion = { mode: 'name-the-note', position: { stringNumber: 4, fret: 7 } }
    const allPositions = range.strings.flatMap((stringNumber) => Array.from({ length: 13 }, (_, fret) => ({ stringNumber, fret })))
    const answers: AnsweredQuestion[] = allPositions.flatMap((position) => {
      const question: FretboardQuestion = { mode: 'name-the-note', position }
      const pitchClass = sameQuestion(question, weak) ? (pitchClassAt(position) + 1) % 12 : pitchClassAt(position)
      return Array.from({ length: 5 }, () => ({ question, answer: { mode: 'name-the-note' as const, pitchClass }, responseMs: 1000 }))
    })
    const records = addSession(emptyPositionRecords(), 'name-the-note', answers)
    const weightOf = questionWeightFrom(records, 'name-the-note')
    const random = seededRandom(42)
    let previous: FretboardQuestion | null = null
    let weakCount = 0
    for (let count = 0; count < 1000; count += 1) {
      const question = nextQuestion('name-the-note', range, previous, random, weightOf)
      if (!question) {
        throw new Error('문제가 없다')
      }
      if (previous) {
        expect(sameQuestion(previous, question)).toBe(false)
      }
      if (sameQuestion(question, weak)) {
        weakCount += 1
      }
      previous = question
    }
    const evenShare = 1000 / allPositions.length
    expect(weakCount).toBeGreaterThan(evenShare * 3)
  })
})
