import { isInRange, pitchClassAt, positionsInRange } from './fretboard.ts'
import type { FretPosition, FretRange } from './fretboard.ts'

export type FretboardMode = 'name-the-note' | 'find-the-position'

export type FretboardQuestion =
  | { mode: 'name-the-note'; position: FretPosition }
  | { mode: 'find-the-position'; stringNumber: number; pitchClass: number }

export type FretboardAnswer = { mode: 'name-the-note'; pitchClass: number } | { mode: 'find-the-position'; position: FretPosition }

type WeightedQuestion = { question: FretboardQuestion; weight: number }

function sameQuestion(left: FretboardQuestion, right: FretboardQuestion): boolean {
  if (left.mode === 'name-the-note' && right.mode === 'name-the-note') {
    return left.position.stringNumber === right.position.stringNumber && left.position.fret === right.position.fret
  }
  if (left.mode === 'find-the-position' && right.mode === 'find-the-position') {
    return left.stringNumber === right.stringNumber && left.pitchClass === right.pitchClass
  }
  return false
}

// 음 보고 위치 찍기는 줄을 고르게, 그 줄 안에서는 음을 고르게 뽑는다. 범위 안에 두 번 나오는 음이 더 자주 나오지 않게 한다.
function weightedCandidates(mode: FretboardMode, range: FretRange): WeightedQuestion[] {
  const positions = positionsInRange(range)
  if (mode === 'name-the-note') {
    return positions.map((position) => ({ question: { mode, position }, weight: 1 }))
  }
  const strings = [...new Set(positions.map((position) => position.stringNumber))]
  return strings.flatMap((stringNumber) => {
    const pitchClasses = [...new Set(positions.filter((position) => position.stringNumber === stringNumber).map(pitchClassAt))]
    return pitchClasses.map((pitchClass) => ({
      question: { mode, stringNumber, pitchClass },
      weight: 1 / (strings.length * pitchClasses.length),
    }))
  })
}

export function candidateQuestions(mode: FretboardMode, range: FretRange): FretboardQuestion[] {
  return weightedCandidates(mode, range).map((candidate) => candidate.question)
}

export function nextQuestion(
  mode: FretboardMode,
  range: FretRange,
  previous: FretboardQuestion | null,
  random: () => number,
): FretboardQuestion | null {
  const all = weightedCandidates(mode, range)
  if (all.length === 0) {
    return null
  }
  const fresh = previous ? all.filter((candidate) => !sameQuestion(candidate.question, previous)) : all
  const pool = fresh.length > 0 ? fresh : all
  const totalWeight = pool.reduce((sum, candidate) => sum + candidate.weight, 0)
  let remaining = random() * totalWeight
  for (const candidate of pool) {
    remaining -= candidate.weight
    if (remaining < 0) {
      return candidate.question
    }
  }
  return pool[pool.length - 1].question
}

export function correctPositions(question: FretboardQuestion, range: FretRange): FretPosition[] {
  if (question.mode === 'name-the-note') {
    return [question.position]
  }
  return positionsInRange(range).filter(
    (position) => position.stringNumber === question.stringNumber && pitchClassAt(position) === question.pitchClass,
  )
}

export function correctPitchClass(question: FretboardQuestion): number {
  return question.mode === 'name-the-note' ? pitchClassAt(question.position) : question.pitchClass
}

export function acceptsTap(question: FretboardQuestion, range: FretRange, position: FretPosition): boolean {
  return question.mode === 'find-the-position' && position.stringNumber === question.stringNumber && isInRange(range, position)
}

export function isCorrectAnswer(question: FretboardQuestion, answer: FretboardAnswer): boolean {
  if (question.mode === 'name-the-note' && answer.mode === 'name-the-note') {
    return pitchClassAt(question.position) === answer.pitchClass
  }
  if (question.mode === 'find-the-position' && answer.mode === 'find-the-position') {
    return answer.position.stringNumber === question.stringNumber && pitchClassAt(answer.position) === question.pitchClass
  }
  return false
}
