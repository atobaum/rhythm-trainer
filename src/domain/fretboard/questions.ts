import { isInRange, pitchClassAt, positionsInRange } from './fretboard.ts'
import type { FretPosition, FretRange } from './fretboard.ts'

export type FretboardMode = 'name-the-note' | 'find-the-position'

export type FretboardQuestion =
  | { mode: 'name-the-note'; position: FretPosition }
  | { mode: 'find-the-position'; stringNumber: number; pitchClass: number }

export type FretboardAnswer = { mode: 'name-the-note'; pitchClass: number } | { mode: 'find-the-position'; position: FretPosition }

export type QuestionWeight = (question: FretboardQuestion) => number

const EVEN_WEIGHT: QuestionWeight = () => 1

export function sameQuestion(left: FretboardQuestion, right: FretboardQuestion): boolean {
  if (left.mode === 'name-the-note' && right.mode === 'name-the-note') {
    return left.position.stringNumber === right.position.stringNumber && left.position.fret === right.position.fret
  }
  if (left.mode === 'find-the-position' && right.mode === 'find-the-position') {
    return left.stringNumber === right.stringNumber && left.pitchClass === right.pitchClass
  }
  return false
}

export function candidateQuestions(mode: FretboardMode, range: FretRange): FretboardQuestion[] {
  const positions = positionsInRange(range)
  if (mode === 'name-the-note') {
    return positions.map((position) => ({ mode, position }))
  }
  const keys = new Set<string>()
  const questions: FretboardQuestion[] = []
  for (const position of positions) {
    const pitchClass = pitchClassAt(position)
    const key = `${position.stringNumber}:${pitchClass}`
    if (!keys.has(key)) {
      keys.add(key)
      questions.push({ mode, stringNumber: position.stringNumber, pitchClass })
    }
  }
  return questions
}

export function nextQuestion(
  mode: FretboardMode,
  range: FretRange,
  previous: FretboardQuestion | null,
  random: () => number,
  weightOf: QuestionWeight = EVEN_WEIGHT,
): FretboardQuestion | null {
  const all = candidateQuestions(mode, range)
  if (all.length === 0) {
    return null
  }
  const fresh = previous ? all.filter((question) => !sameQuestion(question, previous)) : all
  const pool = (fresh.length > 0 ? fresh : all).map((question) => ({ question, weight: weightOf(question) }))
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
