import { pitchClassAt } from './fretboard.ts'
import type { FretPosition } from './fretboard.ts'
import { isCorrectAnswer } from './questions.ts'
import type { FretboardMode, FretboardQuestion } from './questions.ts'
import type { AnsweredQuestion } from './session-result.ts'

export const RECENT_ATTEMPT_LIMIT = 5
export const SLOW_RESPONSE_MS = 3000
const UNSEEN_WEIGHT = 3
const MISS_WEIGHT = 2
const SLOW_WEIGHT = 1

export type RecentAttempt = {
  correct: boolean
  responseMs: number
}

// 키는 방식별 기록 단위다. 위치 보고 음 맞히기는 줄·프렛, 음 보고 위치 찍기는 줄·음.
export type PositionRecords = Record<FretboardMode, Record<string, RecentAttempt[]>>

export type CellTone = 'strong' | 'shaky' | 'weak'

export function emptyPositionRecords(): PositionRecords {
  return { 'name-the-note': {}, 'find-the-position': {} }
}

export function recordKey(question: FretboardQuestion): string {
  return question.mode === 'name-the-note'
    ? `${question.position.stringNumber}:${question.position.fret}`
    : `${question.stringNumber}:${question.pitchClass}`
}

export function recordKeyAt(mode: FretboardMode, position: FretPosition): string {
  return mode === 'name-the-note' ? `${position.stringNumber}:${position.fret}` : `${position.stringNumber}:${pitchClassAt(position)}`
}

export function addSession(records: PositionRecords, mode: FretboardMode, answers: AnsweredQuestion[]): PositionRecords {
  const modeRecords = { ...records[mode] }
  for (const answered of answers) {
    const key = recordKey(answered.question)
    const attempt = { correct: isCorrectAnswer(answered.question, answered.answer), responseMs: answered.responseMs }
    modeRecords[key] = [...(modeRecords[key] ?? []), attempt].slice(-RECENT_ATTEMPT_LIMIT)
  }
  return { ...records, [mode]: modeRecords }
}

function missCount(attempts: RecentAttempt[]): number {
  return attempts.filter((attempt) => !attempt.correct).length
}

function slowCorrectCount(attempts: RecentAttempt[]): number {
  return attempts.filter((attempt) => attempt.correct && attempt.responseMs > SLOW_RESPONSE_MS).length
}

export function attemptWeight(attempts: RecentAttempt[] | undefined): number {
  if (!attempts || attempts.length === 0) {
    return UNSEEN_WEIGHT
  }
  return 1 + MISS_WEIGHT * missCount(attempts) + SLOW_WEIGHT * slowCorrectCount(attempts)
}

export function cellTone(attempts: RecentAttempt[] | undefined): CellTone | null {
  if (!attempts || attempts.length === 0) {
    return null
  }
  const misses = missCount(attempts)
  if (misses >= 2) {
    return 'weak'
  }
  const averageMs = attempts.reduce((sum, attempt) => sum + attempt.responseMs, 0) / attempts.length
  return misses === 0 && averageMs <= SLOW_RESPONSE_MS ? 'strong' : 'shaky'
}

export function questionWeightFrom(records: PositionRecords, mode: FretboardMode): (question: FretboardQuestion) => number {
  return (question) => attemptWeight(records[mode][recordKey(question)])
}
