import { describe, expect, it } from 'vitest'
import { drawnFrets, noteName, pitchClassAt, positionsInRange } from './fretboard.ts'
import type { FretRange } from './fretboard.ts'
import { acceptsTap, candidateQuestions, correctPositions, isCorrectAnswer, nextQuestion } from './questions.ts'
import type { FretboardMode, FretboardQuestion } from './questions.ts'
import { summarizeSession } from './session-result.ts'

const fullRange: FretRange = { strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12 }

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

function sameQuestion(left: FretboardQuestion, right: FretboardQuestion): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

describe('위치의 음', () => {
  it('표준 튜닝 개방현은 1번줄부터 E B G D A E 다', () => {
    expect([1, 2, 3, 4, 5, 6].map((stringNumber) => noteName(pitchClassAt({ stringNumber, fret: 0 })))).toEqual([
      'E',
      'B',
      'G',
      'D',
      'A',
      'E',
    ])
  })

  it('프렛 수만큼 반음 올라가고 12프렛은 개방현과 같다', () => {
    expect(noteName(pitchClassAt({ stringNumber: 6, fret: 3 }))).toBe('G')
    expect(noteName(pitchClassAt({ stringNumber: 5, fret: 1 }))).toBe('A♯/B♭')
    expect(noteName(pitchClassAt({ stringNumber: 3, fret: 12 }))).toBe('G')
  })
})

describe('그리는 범위', () => {
  it('양쪽에 한 칸씩 여유를 더한다', () => {
    expect(drawnFrets({ strings: [2], fromFret: 5, toFret: 8 })).toEqual({ fromFret: 4, toFret: 9 })
  })

  it('0프렛과 15프렛 밖으로 넘지 않는다', () => {
    expect(drawnFrets({ strings: [2], fromFret: 0, toFret: 15 })).toEqual({ fromFret: 0, toFret: 15 })
  })
})

describe('출제', () => {
  it.each<FretboardMode>(['name-the-note', 'find-the-position'])('%s 는 1000번 뽑아도 범위 밖 문제와 연속 같은 문제가 없다', (mode) => {
    const range: FretRange = { strings: [2, 3], fromFret: 5, toFret: 8 }
    const random = seededRandom(42)
    let previous: FretboardQuestion | null = null
    for (let count = 0; count < 1000; count += 1) {
      const question = nextQuestion(mode, range, previous, random)
      expect(question).not.toBeNull()
      if (!question) {
        return
      }
      expect(correctPositions(question, range).length).toBeGreaterThan(0)
      if (question.mode === 'name-the-note') {
        expect(range.strings).toContain(question.position.stringNumber)
        expect(question.position.fret).toBeGreaterThanOrEqual(5)
        expect(question.position.fret).toBeLessThanOrEqual(8)
      } else {
        expect(range.strings).toContain(question.stringNumber)
      }
      if (previous) {
        expect(sameQuestion(previous, question)).toBe(false)
      }
      previous = question
    }
  })

  it('가능한 문제가 하나뿐이면 같은 문제를 다시 낸다', () => {
    const range: FretRange = { strings: [1], fromFret: 3, toFret: 3 }
    const first = nextQuestion('name-the-note', range, null, () => 0)
    expect(nextQuestion('name-the-note', range, first, () => 0)).toEqual(first)
  })

  it('줄을 고르지 않으면 문제가 없다', () => {
    expect(nextQuestion('name-the-note', { strings: [], fromFret: 0, toFret: 12 }, null, () => 0)).toBeNull()
  })

  it('음 보고 위치 찍기는 범위 안에 두 번 나오는 음을 한 문제로 센다', () => {
    const questions = candidateQuestions('find-the-position', { strings: [6], fromFret: 0, toFret: 12 })
    expect(questions).toHaveLength(12)
  })

  it('위치 보고 음 맞히기 후보는 범위 안 모든 위치다', () => {
    expect(candidateQuestions('name-the-note', fullRange)).toHaveLength(positionsInRange(fullRange).length)
    expect(positionsInRange(fullRange)).toHaveLength(78)
  })
})

describe('판정', () => {
  it('위치 보고 음 맞히기는 그 위치의 음 버튼이 정답이다', () => {
    const question: FretboardQuestion = { mode: 'name-the-note', position: { stringNumber: 6, fret: 5 } }
    expect(isCorrectAnswer(question, { mode: 'name-the-note', pitchClass: 9 })).toBe(true)
    expect(isCorrectAnswer(question, { mode: 'name-the-note', pitchClass: 11 })).toBe(false)
  })

  it('같은 줄에 같은 음이 두 곳이면 어느 곳이든 정답이고 정답 위치는 둘이다', () => {
    const question: FretboardQuestion = { mode: 'find-the-position', stringNumber: 6, pitchClass: 4 }
    expect(isCorrectAnswer(question, { mode: 'find-the-position', position: { stringNumber: 6, fret: 0 } })).toBe(true)
    expect(isCorrectAnswer(question, { mode: 'find-the-position', position: { stringNumber: 6, fret: 12 } })).toBe(true)
    expect(isCorrectAnswer(question, { mode: 'find-the-position', position: { stringNumber: 6, fret: 7 } })).toBe(false)
    expect(correctPositions(question, fullRange).map((position) => position.fret)).toEqual([0, 12])
  })

  it('음 보고 위치 찍기에서 문제 줄 밖이나 범위 밖 칸은 받지 않는다', () => {
    const range: FretRange = { strings: [3, 6], fromFret: 0, toFret: 12 }
    const question: FretboardQuestion = { mode: 'find-the-position', stringNumber: 6, pitchClass: 4 }
    expect(acceptsTap(question, range, { stringNumber: 6, fret: 3 })).toBe(true)
    expect(acceptsTap(question, range, { stringNumber: 3, fret: 3 })).toBe(false)
    expect(acceptsTap(question, range, { stringNumber: 6, fret: 13 })).toBe(false)
  })
})

describe('세션 결과', () => {
  it('정답 수, 정답만의 평균 응답 시간, 틀린 문제를 낸다', () => {
    const question: FretboardQuestion = { mode: 'name-the-note', position: { stringNumber: 1, fret: 1 } }
    const result = summarizeSession([
      { question, answer: { mode: 'name-the-note', pitchClass: 5 }, responseMs: 1000 },
      { question, answer: { mode: 'name-the-note', pitchClass: 5 }, responseMs: 2000 },
      { question, answer: { mode: 'name-the-note', pitchClass: 0 }, responseMs: 9000 },
    ])
    expect(result.correctCount).toBe(2)
    expect(result.totalCount).toBe(3)
    expect(result.averageCorrectResponseMs).toBe(1500)
    expect(result.mistakes).toHaveLength(1)
  })

  it('정답이 없으면 평균 응답 시간이 없다', () => {
    expect(summarizeSession([]).averageCorrectResponseMs).toBeNull()
  })
})
