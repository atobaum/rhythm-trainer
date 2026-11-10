import { isCorrectAnswer } from './questions.ts'
import type { FretboardAnswer, FretboardQuestion } from './questions.ts'

export type AnsweredQuestion = {
  question: FretboardQuestion
  answer: FretboardAnswer
  responseMs: number
}

export type FretboardSessionResult = {
  correctCount: number
  totalCount: number
  averageCorrectResponseMs: number | null
  mistakes: AnsweredQuestion[]
}

export function summarizeSession(answers: AnsweredQuestion[]): FretboardSessionResult {
  const correct = answers.filter((answered) => isCorrectAnswer(answered.question, answered.answer))
  return {
    correctCount: correct.length,
    totalCount: answers.length,
    averageCorrectResponseMs:
      correct.length === 0 ? null : correct.reduce((sum, answered) => sum + answered.responseMs, 0) / correct.length,
    mistakes: answers.filter((answered) => !isCorrectAnswer(answered.question, answered.answer)),
  }
}
