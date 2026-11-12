import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MAX_FRET, NOTE_NAMES, STRING_NUMBERS, frequencyAt, noteName, pitchClassAt, positionsInRange } from '../../domain/fretboard/fretboard.ts'
import type { FretPosition, FretRange } from '../../domain/fretboard/fretboard.ts'
import { addSession, cellTone, questionWeightFrom, recordKeyAt } from '../../domain/fretboard/position-records.ts'
import type { PositionRecords } from '../../domain/fretboard/position-records.ts'
import { acceptsTap, correctPitchClass, correctPositions, isCorrectAnswer, nextQuestion } from '../../domain/fretboard/questions.ts'
import type { FretboardAnswer, FretboardMode, FretboardQuestion } from '../../domain/fretboard/questions.ts'
import { summarizeSession } from '../../domain/fretboard/session-result.ts'
import type { AnsweredQuestion, FretboardSessionResult } from '../../domain/fretboard/session-result.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import Fretboard from '../components/Fretboard.tsx'
import type { FretCellTone, FretMark } from '../components/Fretboard.tsx'
import { clearPositionRecords, loadPositionRecords, savePositionRecords } from '../fretboard-records.ts'
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

function recordCellTones(records: PositionRecords, settings: FretboardSettings): FretCellTone[] {
  return positionsInRange(rangeOf(settings)).flatMap((position) => {
    const tone = cellTone(records[settings.mode][recordKeyAt(settings.mode, position)])
    return tone ? [{ position, tone }] : []
  })
}

function hasRecords(records: PositionRecords): boolean {
  return Object.values(records).some((modeRecords) => Object.keys(modeRecords).length > 0)
}

function SetupView({
  settings,
  records,
  onChange,
  onClearRecords,
  onStart,
  areaSwitch,
}: {
  settings: FretboardSettings
  records: PositionRecords
  onChange: (settings: FretboardSettings) => void
  onClearRecords: () => void
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
      <h2 className="section-title">정답 음 소리</h2>
      <ChoiceButtons<'on' | 'off'>
        value={settings.soundEnabled ? 'on' : 'off'}
        onChange={(value) => onChange({ ...settings, soundEnabled: value === 'on' })}
        options={[
          { value: 'on', label: '켬' },
          { value: 'off', label: '끔' },
        ]}
      />
      <div className="fretboard-preview">
        <Fretboard range={rangeOf(settings)} cellTones={recordCellTones(records, settings)} />
      </div>
      {hasRecords(records) && (
        <div className="fretboard-record-legend small muted">
          <span>
            <span className="fretboard-legend-swatch fretboard-cell-strong-swatch" />
            익숙함
          </span>
          <span>
            <span className="fretboard-legend-swatch fretboard-cell-shaky-swatch" />
            흔들림
          </span>
          <span>
            <span className="fretboard-legend-swatch fretboard-cell-weak-swatch" />
            약함
          </span>
          <button type="button" className="secondary-button fretboard-clear-records" onClick={onClearRecords}>
            기록 지우기
          </button>
        </div>
      )}
      {settings.strings.length === 0 && <p className="muted small">줄을 하나 이상 골라 주세요.</p>}
      <button type="button" className="start-button" disabled={settings.strings.length === 0} onClick={onStart}>
        시작
      </button>
    </div>
  )
}

type Feedback = { answer: FretboardAnswer; correct: boolean }

function soundPosition(question: FretboardQuestion, answer: FretboardAnswer, range: FretRange): FretPosition {
  if (question.mode === 'name-the-note') {
    return question.position
  }
  if (answer.mode === 'find-the-position' && isCorrectAnswer(question, answer)) {
    return answer.position
  }
  return correctPositions(question, range).reduce((lowest, position) => (position.fret < lowest.fret ? position : lowest))
}

function QuizView({
  settings,
  records,
  onFinish,
  onQuit,
}: {
  settings: FretboardSettings
  records: PositionRecords
  onFinish: (answers: AnsweredQuestion[]) => void
  onQuit: () => void
}) {
  const range = useMemo(() => rangeOf(settings), [settings])
  const [weightOf] = useState(() => questionWeightFrom(records, settings.mode))
  const onFinishRef = useRef(onFinish)
  const [question, setQuestion] = useState(() => nextQuestion(settings.mode, range, null, Math.random, weightOf))
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
        setQuestion(nextQuestion(settings.mode, range, question, Math.random, weightOf))
      },
      feedback.correct ? FRETBOARD_TIMING.correctAdvanceMs : FRETBOARD_TIMING.wrongAdvanceMs,
    )
    return () => window.clearTimeout(timer)
  }, [feedback, question, answers, settings, range, weightOf])

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
    if (settings.soundEnabled) {
      audioEngine.playNow('melody', frequencyAt(soundPosition(question, given, range)))
    }
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
  const [records, setRecords] = useState(loadPositionRecords)
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' })
  const attemptRef = useRef(0)

  const goHome = () => setScreen({ kind: 'setup' })
  useBackToHome(screen.kind === 'setup', goHome)

  const changeSettings = (next: FretboardSettings) => {
    setSettings(next)
    saveFretboardSettings(next)
  }

  const clearRecords = () => {
    if (window.confirm('지판 기록을 모두 지울까요?')) {
      setRecords(clearPositionRecords())
    }
  }

  const finish = (answers: AnsweredQuestion[]) => {
    const next = addSession(records, settings.mode, answers)
    setRecords(next)
    savePositionRecords(next)
    setScreen({ kind: 'result', result: summarizeSession(answers) })
  }

  const start = () => {
    if (settings.soundEnabled) {
      void audioEngine.unlock()
    }
    attemptRef.current += 1
    setScreen({ kind: 'quiz', attempt: attemptRef.current })
  }

  if (screen.kind === 'quiz') {
    return (
      <QuizView
        key={screen.attempt}
        settings={settings}
        records={records}
        onFinish={finish}
        onQuit={goHome}
      />
    )
  }
  if (screen.kind === 'result') {
    return <ResultView result={screen.result} onRetry={start} onHome={goHome} />
  }
  return (
    <SetupView
      settings={settings}
      records={records}
      onChange={changeSettings}
      onClearRecords={clearRecords}
      onStart={start}
      areaSwitch={areaSwitch}
    />
  )
}
