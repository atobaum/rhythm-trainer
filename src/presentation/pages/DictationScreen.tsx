import { useEffect, useMemo, useRef, useState } from 'react'
import { dictationSounds } from '../../application/dictation-session.ts'
import type { Stage } from '../../domain/curriculum/stages.ts'
import { STAGES } from '../../domain/curriculum/stages.ts'
import { cellsBeats, makeChoiceQuestion, makeComposeQuestion, wrongBeats } from '../../domain/dictation/dictation.ts'
import { iconPattern, patternFromCells } from '../../domain/rhythm/generator.ts'
import type { Cell } from '../../domain/rhythm/generator.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import ScoreView from '../components/ScoreView.tsx'

export type DictationKind = 'choice' | 'compose'

type Props = {
  stage: Stage
  kind: DictationKind
  bpm: number
  seed: number
  onFinish: (correctCount: number, total: number) => void
  onCancel: () => void
  onRetry: () => void
}

const QUESTION_COUNT = 5
const OPTION_LETTERS = ['A', 'B', 'C', 'D']

function CellIcon({ cell, id }: { cell: Cell; id: string }) {
  const pattern = useMemo(() => iconPattern(id, [cell]), [cell, id])
  return <ScoreView pattern={pattern} minimal />
}

export default function DictationScreen({ stage, kind, bpm, seed, onFinish, onCancel, onRetry }: Props) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [composed, setComposed] = useState<Cell[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const playbackRef = useRef<{ start: number; timer: number } | null>(null)

  const questionSeed = seed * 31 + questionIndex
  const choice = useMemo(() => {
    if (kind !== 'choice') {
      return null
    }
    const earlier = STAGES.slice(0, stage.number - 1).reverse().map((candidate) => candidate.spec)
    return makeChoiceQuestion([stage.spec, ...earlier], questionSeed)
  }, [kind, stage, questionSeed])
  const compose = useMemo(() => (kind === 'compose' ? makeComposeQuestion(stage.spec, questionSeed) : null), [kind, stage, questionSeed])
  const answer: RhythmPattern = choice ? choice.options[choice.answerIndex] : compose!.answer

  const stopPlayback = () => {
    if (playbackRef.current) {
      window.clearTimeout(playbackRef.current.timer)
      audioEngine.stopSessionStartedAt(playbackRef.current.start)
      playbackRef.current = null
    }
    setPlaying(null)
  }

  useEffect(() => () => stopPlayback(), [])

  const play = async (pattern: RhythmPattern, label: string) => {
    stopPlayback()
    await audioEngine.unlock()
    const { sounds, durationMs } = dictationSounds(pattern, bpm)
    const start = audioEngine.playSession(sounds)
    playbackRef.current = { start, timer: window.setTimeout(() => setPlaying(null), durationMs + 500) }
    setPlaying(label)
  }

  const composedPattern =
    compose && cellsBeats(composed) === compose.totalBeats
      ? patternFromCells('composed', '내 답', composed, { beatsPerBar: stage.spec.beatsPerBar, bars: stage.spec.bars })
      : null
  const wrong = compose && submitted ? wrongBeats(compose.answerCells, composed) : []
  const isCorrect = choice ? selected === choice.answerIndex : wrong.length === 0
  const canSubmit = choice ? selected !== null : composedPattern !== null

  const submit = () => {
    setSubmitted(true)
    if (choice ? selected === choice.answerIndex : wrongBeats(compose!.answerCells, composed).length === 0) {
      setCorrectCount((count) => count + 1)
    }
  }

  const next = () => {
    stopPlayback()
    if (questionIndex + 1 >= QUESTION_COUNT) {
      onFinish(correctCount, QUESTION_COUNT)
      setFinished(true)
      return
    }
    setQuestionIndex((index) => index + 1)
    setSelected(null)
    setComposed([])
    setSubmitted(false)
  }

  const beatName = (beat: number) => {
    const beatsPerBar = stage.spec.beatsPerBar
    const inBar = `${(beat % beatsPerBar) + 1}박`
    return stage.spec.bars > 1 ? `${Math.floor(beat / beatsPerBar) + 1}마디 ${inBar}` : inBar
  }
  const filledBeats = compose ? cellsBeats(composed) : 0
  const fits = (cell: Cell) =>
    compose !== null &&
    filledBeats + cell.beats <= compose.totalBeats &&
    (filledBeats % stage.spec.beatsPerBar) + cell.beats <= stage.spec.beatsPerBar

  if (finished) {
    return (
      <div className="result">
        <h2 className="result-title">
          {QUESTION_COUNT}문제 중 {correctCount}개 맞혔어요
        </h2>
        <p className="muted">
          {stage.number}. {stage.title} · {kind === 'choice' ? '악보 고르기' : '악보 완성하기'} · {bpm} BPM
        </p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={onRetry}>
            새 문제로 다시
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dictation">
      <header className="session-header">
        <button type="button" className="link-button" onClick={onCancel}>
          ← 그만하기
        </button>
        <span className="muted">
          {stage.number}. {stage.title} · {questionIndex + 1}/{QUESTION_COUNT} · {bpm} BPM
        </span>
        <span className="muted">맞힘 {correctCount}</span>
      </header>

      <h2 className="section-title">{kind === 'choice' ? '듣고 맞는 악보를 고르세요' : '듣고 박마다 음형을 채우세요'}</h2>
      <div className="button-row">
        {playing === 'question' ? (
          <button type="button" className="secondary-button" onClick={stopPlayback}>
            ■ 정지
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => play(answer, 'question')}>
            ▶ 리듬 듣기
          </button>
        )}
      </div>

      {choice && (
        <div className="choice-options">
          {choice.options.map((option, index) => {
            const state = submitted
              ? index === choice.answerIndex
                ? 'option-correct'
                : index === selected
                  ? 'option-wrong'
                  : ''
              : index === selected
                ? 'option-selected'
                : ''
            return (
              <button
                type="button"
                key={option.id}
                className={`dictation-option ${state}`}
                disabled={submitted}
                onClick={() => setSelected(index)}
              >
                <span className="option-letter">{OPTION_LETTERS[index]}</span>
                <ScoreView pattern={option} />
              </button>
            )
          })}
        </div>
      )}

      {compose && (
        <>
          <div className="compose-slots">
            {Array.from({ length: compose.totalBeats }, (_, beat) => {
              let start = 0
              const cellIndex = composed.findIndex((cell) => {
                const found = beat >= start && beat < start + cell.beats
                start += cell.beats
                return found
              })
              const cellStart = composed.slice(0, cellIndex).reduce((sum, cell) => sum + cell.beats, 0)
              const isWrong = wrong.includes(beat)
              const classes = ['compose-slot', submitted ? (isWrong ? 'slot-wrong' : 'slot-correct') : '', beat % stage.spec.beatsPerBar === 0 ? 'slot-bar-start' : ''].join(' ')
              if (cellIndex === -1) {
                return (
                  <div key={beat} className={classes}>
                    ?
                  </div>
                )
              }
              return (
                <div key={beat} className={classes}>
                  {beat === cellStart ? <CellIcon cell={composed[cellIndex]} id={`slot-${cellIndex}`} /> : <span className="muted">⌒</span>}
                </div>
              )
            })}
          </div>
          {!submitted && (
            <>
              <div className="compose-palette">
                {compose.palette.map((cell, index) => (
                  <button
                    type="button"
                    key={index}
                    className={cell.beats === 2 ? 'palette-item palette-wide' : 'palette-item'}
                    disabled={!fits(cell)}
                    onClick={() => setComposed((cells) => [...cells, cell])}
                  >
                    <CellIcon cell={cell} id={`palette-${index}`} />
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button type="button" className="secondary-button" disabled={composed.length === 0} onClick={() => setComposed((cells) => cells.slice(0, -1))}>
                  ⌫ 하나 지우기
                </button>
                <button type="button" className="secondary-button" disabled={composed.length === 0} onClick={() => setComposed([])}>
                  모두 지우기
                </button>
              </div>
            </>
          )}
        </>
      )}

      {submitted ? (
        <section className="dictation-feedback">
          <p className={isCorrect ? 'insight insight-good' : 'insight'}>
            {isCorrect ? '정답이에요!' : choice ? `정답은 ${OPTION_LETTERS[choice.answerIndex]} 예요.` : `${wrong.map(beatName).join(', ')}이 달라요.`}
          </p>
          {compose && (
            <div className="compare-scores">
              <span className="muted small">정답</span>
              <ScoreView pattern={compose.answer} />
              {composedPattern && (
                <>
                  <span className="muted small">내 답</span>
                  <ScoreView pattern={composedPattern} />
                </>
              )}
            </div>
          )}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => play(answer, 'answer')}>
              ▶ 정답 듣기
            </button>
            {!isCorrect && (choice ? selected !== null : composedPattern) && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => play(choice ? choice.options[selected!] : composedPattern!, 'mine')}
              >
                ▶ 내 답 듣기
              </button>
            )}
            <button type="button" className="primary-button" onClick={next}>
              {questionIndex + 1 >= QUESTION_COUNT ? '결과 보기' : '다음 문제 →'}
            </button>
          </div>
        </section>
      ) : (
        <button type="button" className="start-button" disabled={!canSubmit} onClick={submit}>
          제출
        </button>
      )}
    </div>
  )
}
