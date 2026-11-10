import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MAX_FRET, NOTE_NAMES, STRING_NUMBERS, noteName, pitchClassAt } from '../../domain/fretboard/fretboard.ts'
import type { FretPosition } from '../../domain/fretboard/fretboard.ts'
import { acceptsTap, correctPitchClass, correctPositions, isCorrectAnswer, nextQuestion } from '../../domain/fretboard/questions.ts'
import type { FretboardAnswer, FretboardMode, FretboardQuestion } from '../../domain/fretboard/questions.ts'
import { summarizeSession } from '../../domain/fretboard/session-result.ts'
import type { AnsweredQuestion, FretboardSessionResult } from '../../domain/fretboard/session-result.ts'
import Fretboard from '../components/Fretboard.tsx'
import type { FretMark } from '../components/Fretboard.tsx'
import { QUESTION_COUNTS, loadFretboardSettings, rangeOf, saveFretboardSettings } from '../fretboard-settings.ts'
import type { FretboardSettings } from '../fretboard-settings.ts'
import { useBackToHome } from '../hooks/use-back-to-home.ts'

const FRETBOARD_TIMING = {
  correctAdvanceMs: 500,
  wrongAdvanceMs: 1500,
}

const MODE_LABELS: Record<FretboardMode, string> = {
  'name-the-note': '위치 보고 음 맞히기',
  'find-the-position': '음 보고 위치 찍기',
}

type Screen = { kind: 'setup' } | { kind: 'quiz'; attempt: number } | { kind: 'result'; result: FretboardSessionResult }

function ChoiceButtons<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="choice">
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className={option.value === value ? 'choice-item choice-selected' : 'choice-item'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function FretSelect({ label, value, onChange }: { label: string; value: number; onChange: (fret: number) => void }) {
  return (
    <label className="fret-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {Array.from({ length: MAX_FRET + 1 }, (_, fret) => (
          <option key={fret} value={fret}>
            {fret}
          </option>
        ))}
      </select>
    </label>
  )
}

function describeQuestion(question: FretboardQuestion): string {
  return question.mode === 'name-the-note'
    ? `${question.position.stringNumber}번줄 ${question.position.fret}프렛`
    : `${question.stringNumber}번줄 ${noteName(question.pitchClass)}`
}

function describeAnswer(answer: FretboardAnswer): string {
  return answer.mode === 'name-the-note'
    ? noteName(answer.pitchClass)
    : `${answer.position.fret}프렛(${noteName(pitchClassAt(answer.position))})`
}

function SetupView({
  settings,
  onChange,
  onStart,
  areaSwitch,
}: {
  settings: FretboardSettings
  onChange: (settings: FretboardSettings) => void
  onStart: () => void
  areaSwitch: ReactNode
}) {
  const toggleString = (stringNumber: number) => {
    const strings = settings.strings.includes(stringNumber)
      ? settings.strings.filter((candidate) => candidate !== stringNumber)
      : STRING_NUMBERS.filter((candidate) => candidate === stringNumber || settings.strings.includes(candidate))
    onChange({ ...settings, strings })
  }

  return (
    <div className="setup fretboard-setup">
      {areaSwitch}
      <h1 className="app-title">지판 외우기</h1>
      <h2 className="section-title">방식</h2>
      <ChoiceButtons<FretboardMode>
        value={settings.mode}
        onChange={(mode) => onChange({ ...settings, mode })}
        options={[
          { value: 'name-the-note', label: MODE_LABELS['name-the-note'] },
          { value: 'find-the-position', label: MODE_LABELS['find-the-position'] },
        ]}
      />
      <h2 className="section-title">줄</h2>
      <div className="choice">
        {STRING_NUMBERS.map((stringNumber) => (
          <button
            type="button"
            key={stringNumber}
            className={settings.strings.includes(stringNumber) ? 'choice-item choice-selected' : 'choice-item'}
            onClick={() => toggleString(stringNumber)}
            aria-pressed={settings.strings.includes(stringNumber)}
          >
            {stringNumber}번
          </button>
        ))}
      </div>
      <h2 className="section-title">프렛</h2>
      <div className="fret-range">
        <FretSelect
          label="시작"
          value={settings.fromFret}
          onChange={(fromFret) => onChange({ ...settings, fromFret, toFret: Math.max(fromFret, settings.toFret) })}
        />
        <span aria-hidden="true">~</span>
        <FretSelect
          label="끝"
          value={settings.toFret}
          onChange={(toFret) => onChange({ ...settings, toFret, fromFret: Math.min(toFret, settings.fromFret) })}
        />
      </div>
      <h2 className="section-title">문제 수</h2>
      <ChoiceButtons
        value={settings.questionCount}
        onChange={(questionCount) => onChange({ ...settings, questionCount })}
        options={QUESTION_COUNTS.map((count) => ({ value: count, label: `${count}문제` }))}
      />
      <div className="fretboard-preview">
        <Fretboard range={rangeOf(settings)} />
      </div>
      {settings.strings.length === 0 && <p className="muted small">줄을 하나 이상 골라 주세요.</p>}
      <button type="button" className="start-button" disabled={settings.strings.length === 0} onClick={onStart}>
        시작
      </button>
    </div>
  )
}

type Feedback = { answer: FretboardAnswer; correct: boolean }

function QuizView({
  settings,
  onFinish,
  onQuit,
}: {
  settings: FretboardSettings
  onFinish: (answers: AnsweredQuestion[]) => void
  onQuit: () => void
}) {
  const range = useMemo(() => rangeOf(settings), [settings])
  const onFinishRef = useRef(onFinish)
  const [question, setQuestion] = useState(() => nextQuestion(settings.mode, range, null, Math.random))
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const shownAtRef = useRef(0)

  useEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    shownAtRef.current = performance.now()
  }, [question])

  useEffect(() => {
    if (!feedback || !question) {
      return
    }
    const timer = window.setTimeout(
      () => {
        if (answers.length >= settings.questionCount) {
          onFinishRef.current(answers)
          return
        }
        setFeedback(null)
        setQuestion(nextQuestion(settings.mode, range, question, Math.random))
      },
      feedback.correct ? FRETBOARD_TIMING.correctAdvanceMs : FRETBOARD_TIMING.wrongAdvanceMs,
    )
    return () => window.clearTimeout(timer)
  }, [feedback, question, answers, settings, range])

  if (!question) {
    return null
  }

  const answer = (given: FretboardAnswer, timeStamp: number) => {
    if (feedback) {
      return
    }
    const correct = isCorrectAnswer(question, given)
    setAnswers((previous) => [...previous, { question, answer: given, responseMs: Math.max(0, timeStamp - shownAtRef.current) }])
    setFeedback({ answer: given, correct })
  }

  const handleTap = (position: FretPosition, timeStamp: number) => {
    if (acceptsTap(question, range, position)) {
      answer({ mode: 'find-the-position', position }, timeStamp)
    }
  }

  const marks: FretMark[] = []
  if (question.mode === 'name-the-note') {
    marks.push({ position: question.position, tone: feedback ? (feedback.correct ? 'correct' : 'wrong') : 'question' })
  } else if (feedback && feedback.answer.mode === 'find-the-position') {
    if (feedback.correct) {
      marks.push({ position: feedback.answer.position, tone: 'correct' })
    } else {
      marks.push({ position: feedback.answer.position, tone: 'wrong' })
      marks.push(...correctPositions(question, range).map((position) => ({ position, tone: 'correct' as const })))
    }
  }

  const answerPitchClass = correctPitchClass(question)
  const questionNumber = answers.length + (feedback ? 0 : 1)

  return (
    <div className="fretboard-quiz">
      <header className="fretboard-quiz-header">
        <span className="muted">
          {MODE_LABELS[settings.mode]} · {questionNumber}/{settings.questionCount}
        </span>
        <button type="button" className="secondary-button fretboard-quit" onClick={onQuit}>
          그만두기
        </button>
      </header>
      <p className="fretboard-prompt">
        {question.mode === 'name-the-note'
          ? '이 위치의 음은?'
          : `${question.stringNumber}번줄에서 ${noteName(question.pitchClass)}`}
      </p>
      <Fretboard
        range={range}
        marks={marks}
        highlightString={question.mode === 'find-the-position' ? question.stringNumber : undefined}
        onTap={question.mode === 'find-the-position' ? handleTap : undefined}
      />
      <p className={feedback ? `fretboard-feedback ${feedback.correct ? 'fretboard-correct' : 'fretboard-wrong'}` : 'fretboard-feedback'}>
        {feedback ? (feedback.correct ? '정답' : `오답 · 정답은 ${noteName(answerPitchClass)}`) : ' '}
      </p>
      {question.mode === 'name-the-note' && (
        <div className="note-buttons">
          {NOTE_NAMES.map((name, pitchClass) => {
            const chosen = feedback?.answer.mode === 'name-the-note' && feedback.answer.pitchClass === pitchClass
            const tone = feedback ? (pitchClass === answerPitchClass ? ' note-correct' : chosen ? ' note-wrong' : '') : ''
            return (
              <button
                type="button"
                key={name}
                className={`note-button${tone}`}
                onPointerDown={(event) => answer({ mode: 'name-the-note', pitchClass }, event.timeStamp)}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResultView({
  result,
  onRetry,
  onHome,
}: {
  result: FretboardSessionResult
  onRetry: () => void
  onHome: () => void
}) {
  return (
    <div className="result fretboard-result">
      <h1 className="app-title">결과</h1>
      <p className="fretboard-score">
        {result.correctCount} / {result.totalCount}
      </p>
      <p className="muted">
        평균 응답 시간{' '}
        {result.averageCorrectResponseMs === null ? '-' : `${(result.averageCorrectResponseMs / 1000).toFixed(1)}초`}
      </p>
      {result.mistakes.length > 0 && (
        <>
          <h2 className="section-title">틀린 문제</h2>
          <ul className="fretboard-mistakes">
            {result.mistakes.map((mistake, index) => (
              <li key={index}>
                {describeQuestion(mistake.question)} · 정답 {noteName(correctPitchClass(mistake.question))} · 고른 답{' '}
                {describeAnswer(mistake.answer)}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="fretboard-result-actions">
        <button type="button" className="primary-button" onClick={onRetry}>
          다시 하기
        </button>
        <button type="button" className="secondary-button" onClick={onHome}>
          처음으로
        </button>
      </div>
    </div>
  )
}

export default function FretboardApp({ areaSwitch }: { areaSwitch: ReactNode }) {
  const [settings, setSettings] = useState(loadFretboardSettings)
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' })
  const attemptRef = useRef(0)

  const goHome = () => setScreen({ kind: 'setup' })
  useBackToHome(screen.kind === 'setup', goHome)

  const changeSettings = (next: FretboardSettings) => {
    setSettings(next)
    saveFretboardSettings(next)
  }

  const start = () => {
    attemptRef.current += 1
    setScreen({ kind: 'quiz', attempt: attemptRef.current })
  }

  if (screen.kind === 'quiz') {
    return (
      <QuizView
        key={screen.attempt}
        settings={settings}
        onFinish={(answers) => setScreen({ kind: 'result', result: summarizeSession(answers) })}
        onQuit={goHome}
      />
    )
  }
  if (screen.kind === 'result') {
    return <ResultView result={screen.result} onRetry={start} onHome={goHome} />
  }
  return <SetupView settings={settings} onChange={changeSettings} onStart={start} areaSwitch={areaSwitch} />
}
