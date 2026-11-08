import { useCallback, useEffect, useRef, useState } from 'react'
import { buildReplaySounds } from '../../application/replay.ts'
import type { Grade, Judgement } from '../../domain/evaluation/matcher.ts'
import { computeMetrics } from '../../domain/evaluation/metrics.ts'
import type { PracticeMetrics } from '../../domain/evaluation/metrics.ts'
import { noteBiases } from '../../domain/evaluation/note-bias.ts'
import { handSynchrony, metricsByTrack } from '../../domain/evaluation/hand-stats.ts'
import { describePosition, objectParticle } from '../../domain/rhythm/counting.ts'
import { createFraction, fractionToNumber, subtractFractions } from '../../domain/rhythm/fraction.ts'
import { patternLength } from '../../domain/rhythm/pattern.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import ScoreView from '../components/ScoreView.tsx'
import type { PositionToX } from '../components/ScoreView.tsx'
import TimingTrack from '../components/TimingTrack.tsx'
import { MARK_LABELS, MARK_SYMBOLS } from '../components/judgement-style.ts'
import type { RecordUpdate } from '../practice-records.ts'
import type { SessionResult } from './SessionScreen.tsx'

type Props = {
  pattern: RhythmPattern
  result: SessionResult
  stars: number
  record: RecordUpdate | null
  tempoChange: number
  nextBpm: number
  autoTempo: boolean
  layout?: 'loop' | 'song'
  onRetry: () => void
  onBack: () => void
  backLabel?: string
  onNext: (() => void) | null
  nextLabel: string
}

const NOTICEABLE_BIAS_MS = 15
const REPORTED_BIAS_MS = 25

function tendency(meanSignedErrorMs: number | null): string {
  if (meanSignedErrorMs === null) {
    return '-'
  }
  const rounded = Math.round(meanSignedErrorMs)
  if (Math.abs(rounded) <= 5) {
    return '치우침 없음'
  }
  return rounded > 0 ? `평균 ${rounded}ms 늦게` : `평균 ${-rounded}ms 빠르게`
}

function judgementTimeMs(judgement: Judgement): number {
  return judgement.kind === 'extra' ? judgement.tap.timeMs : judgement.expected.targetTimeMs
}

function GapSplit({ withClick, inGap }: { withClick: PracticeMetrics; inGap: PracticeMetrics }) {
  const describe = (metrics: PracticeMetrics) =>
    `${Math.round(metrics.hitRate * 100)}% · ${metrics.meanAbsoluteErrorMs === null ? '-' : `${Math.round(metrics.meanAbsoluteErrorMs)}ms`} · ${tendency(metrics.meanSignedErrorMs)}`
  return (
    <div className="gap-split">
      <div>
        <strong>기준음 있을 때</strong> <span className="muted">{describe(withClick)}</span>
      </div>
      <div>
        <strong>소리 없이 셀 때</strong> <span className="muted">{describe(inGap)}</span>
      </div>
    </div>
  )
}

export default function ResultScreen({
  pattern,
  result,
  stars,
  record,
  tempoChange,
  nextBpm,
  autoTempo,
  layout = 'loop',
  onRetry,
  onBack,
  backLabel = '목록으로',
  onNext,
  nextLabel,
}: Props) {
  const { metrics, judgements } = result
  const [positionToX, setPositionToX] = useState<PositionToX>(() => (position: number) => position)
  const handleScoreLayout = useCallback((mapping: PositionToX) => setPositionToX(() => mapping), [])
  const [playing, setPlaying] = useState<'mine' | 'answer' | null>(null)
  const playbackTimerRef = useRef<number | undefined>(undefined)
  const replayStartRef = useRef<number | null>(null)

  // 화면을 떠날 때는 여기서 시작한 다시 듣기만 끈다. 다음 연습 소리는 이미 새로 시작됐을 수 있다.
  useEffect(
    () => () => {
      window.clearTimeout(playbackTimerRef.current)
      if (replayStartRef.current !== null) {
        audioEngine.stopSessionStartedAt(replayStartRef.current)
      }
    },
    [],
  )

  const gradeCount = (grade: Grade) =>
    judgements.filter((judgement) => judgement.kind === 'hit' && judgement.grade === grade).length

  const relativeMs = (timeMs: number) => timeMs - result.firstRepetitionStartMs
  const inGap = (judgement: Judgement) =>
    result.mutedBars.includes(Math.floor(relativeMs(judgementTimeMs(judgement)) / result.barMs))
  const hasGap = result.mutedBars.length > 0

  const totalLength = fractionToNumber(patternLength(pattern))
  const barLength = createFraction(pattern.timeSignature.numerator, pattern.timeSignature.denominator)
  const beatLength = createFraction(1, pattern.timeSignature.denominator)
  const trackIds = pattern.tracks.map((track) => track.id)
  const byTrack = metricsByTrack(judgements, trackIds)
  const synchrony = handSynchrony(judgements)
  const biases = noteBiases(judgements)
  const worst = biases
    .filter((bias) => bias.meanSignedErrorMs !== null && Math.abs(bias.meanSignedErrorMs) >= REPORTED_BIAS_MS)
    .sort((left, right) => Math.abs(right.meanSignedErrorMs ?? 0) - Math.abs(left.meanSignedErrorMs ?? 0))[0]

  let worstMessage: string | null = null
  if (worst?.meanSignedErrorMs != null) {
    const barIndex = Math.floor(fractionToNumber(worst.onset) / fractionToNumber(barLength))
    const onsetInBar = subtractFractions(worst.onset, createFraction(barIndex * barLength.numerator, barLength.denominator))
    const where = describePosition(onsetInBar, beatLength) ?? '이 음표'
    const amount = Math.round(Math.abs(worst.meanSignedErrorMs))
    worstMessage = `${pattern.bars > 1 ? `${barIndex + 1}마디 ` : ''}${where}${objectParticle(where)} 평균 ${amount}ms ${worst.meanSignedErrorMs > 0 ? '늦게' : '빠르게'} 쳐요.`
  }

  const play = async (which: 'mine' | 'answer') => {
    await audioEngine.unlock()
    const hitTimesMs =
      which === 'mine'
        ? judgements.flatMap((judgement) => (judgement.kind === 'miss' ? [] : [relativeMs(judgement.tap.timeMs)]))
        : result.expectedEvents.map((event) => relativeMs(event.targetTimeMs))
    replayStartRef.current = audioEngine.playSession(
      buildReplaySounds({
        hitTimesMs,
        performMs: result.patternMs * result.repetitions,
        beatMs: result.beatMs,
        beatsPerBar: result.beatsPerBar,
        kind: which === 'mine' ? 'tap' : 'note',
      }),
    )
    setPlaying(which)
    const playbackMs = result.beatMs * result.beatsPerBar + result.patternMs * result.repetitions + 800
    window.clearTimeout(playbackTimerRef.current)
    playbackTimerRef.current = window.setTimeout(() => setPlaying(null), playbackMs)
  }

  const stop = () => {
    window.clearTimeout(playbackTimerRef.current)
    if (replayStartRef.current !== null) {
      audioEngine.stopSessionStartedAt(replayStartRef.current)
    }
    setPlaying(null)
  }

  return (
    <div className="result">
      <h2 className="result-title">
        <span className="stars big-stars">
          {'★'.repeat(stars)}
          {'☆'.repeat(5 - stars)}
        </span>{' '}
        {layout === 'song' ? '끝까지 쳤어요' : result.passed ? '통과!' : '건너뛰었어요'}
      </h2>
      <p className="muted">
        {pattern.title} · {result.bpm} BPM · {layout === 'song' ? `${pattern.bars}마디` : `${result.repetitionsPlayed}번 반복`}
        {record?.newBestStars && <span className="new-record"> 별 최고 기록!</span>}
        {record?.newBestBpm && <span className="new-record"> 최고 템포 기록!</span>}
      </p>

      <div className="metric-grid">
        <div className="metric">
          <div className="metric-value">{Math.round(metrics.hitRate * 100)}%</div>
          <div className="metric-label">
            맞힌 음표 ({metrics.hitCount}/{metrics.expectedCount})
          </div>
        </div>
        <div className="metric">
          <div className="metric-value">
            {metrics.meanAbsoluteErrorMs === null ? '-' : `${Math.round(metrics.meanAbsoluteErrorMs)}ms`}
          </div>
          <div className="metric-label">평균 오차</div>
        </div>
        <div className="metric">
          <div className="metric-value metric-small">{tendency(metrics.meanSignedErrorMs)}</div>
          <div className="metric-label">경향</div>
        </div>
      </div>

      <div className="grade-row">
        {(['perfect', 'great', 'good'] as const).map((grade) => (
          <span key={grade} className={`mark-text-${grade}`}>
            {MARK_SYMBOLS[grade]} {MARK_LABELS[grade]} {gradeCount(grade)}
          </span>
        ))}
        <span className="mark-text-miss">
          {MARK_SYMBOLS.miss} Miss {metrics.missCount}
        </span>
        <span className="mark-text-extra">
          {MARK_SYMBOLS.extra} Extra {metrics.extraCount}
        </span>
        {(metrics.directionErrorCount > 0 || judgements.some((judgement) => judgement.kind === 'hit' && judgement.tap.direction !== undefined)) && (
          <span className="mark-text-direction">
            {MARK_SYMBOLS.direction} 방향 틀림 {metrics.directionErrorCount}
          </span>
        )}
      </div>

      {trackIds.length > 1 && (
        <div className="gap-split">
          {trackIds.map((trackId) => {
            const handMetrics = byTrack.get(trackId)!
            return (
              <div key={trackId}>
                <strong>{trackId === 'left' ? '왼손' : '오른손'}</strong>{' '}
                <span className="muted">
                  {Math.round(handMetrics.hitRate * 100)}% · {handMetrics.meanAbsoluteErrorMs === null ? '-' : `${Math.round(handMetrics.meanAbsoluteErrorMs)}ms`} ·{' '}
                  {tendency(handMetrics.meanSignedErrorMs)} · Extra {handMetrics.extraCount}
                </span>
              </div>
            )
          })}
          {synchrony.meanGapMs !== null && (
            <div>
              <strong>함께 칠 때</strong>{' '}
              <span className="muted">
                두 손 간격 평균 {Math.round(synchrony.meanGapMs)}ms ({synchrony.pairCount}번)
              </span>
            </div>
          )}
        </div>
      )}
      {worstMessage && <p className="insight">{worstMessage}</p>}
      {hasGap && (
        <GapSplit
          withClick={computeMetrics(judgements.filter((judgement) => !inGap(judgement)))}
          inGap={computeMetrics(judgements.filter(inGap))}
        />
      )}

      {autoTempo && (
        <p className="tempo-note">
          {tempoChange > 0 && `빨리 통과했어요. 다음은 ${nextBpm} BPM (+${tempoChange})`}
          {tempoChange < 0 && `조금 천천히 해봐요. 다음은 ${nextBpm} BPM (${tempoChange})`}
          {tempoChange === 0 && `다음도 ${nextBpm} BPM`}
        </p>
      )}

      {layout === 'loop' && (
      <div className="button-row">
        {playing === null ? (
          <>
            <button type="button" className="secondary-button" onClick={() => play('mine')}>
              ▶ 내 연주 듣기
            </button>
            <button type="button" className="secondary-button" onClick={() => play('answer')}>
              ▶ 정답 듣기
            </button>
          </>
        ) : (
          <button type="button" className="secondary-button" onClick={stop}>
            ■ 정지 ({playing === 'mine' ? '내 연주' : '정답'})
          </button>
        )}
      </div>
      )}

      {layout === 'loop' && (
      <section className="result-tracks">
        <div className="result-repetition">
          <span />
          <ScoreView pattern={pattern} onLayout={handleScoreLayout} />
        </div>
        <div className="result-repetition">
          <span className="muted small">치우침</span>
          <div className="bias-row">
            {biases.map((bias) =>
              bias.meanSignedErrorMs !== null && Math.abs(bias.meanSignedErrorMs) >= NOTICEABLE_BIAS_MS ? (
                <span
                  key={bias.patternEventId}
                  className={bias.meanSignedErrorMs > 0 ? 'bias-label bias-late' : 'bias-label bias-early'}
                  style={{ left: `${positionToX(fractionToNumber(bias.onset) / totalLength) * 100}%` }}
                >
                  {bias.meanSignedErrorMs > 0 ? '+' : ''}
                  {Math.round(bias.meanSignedErrorMs)}
                </span>
              ) : null,
            )}
          </div>
        </div>
        {Array.from({ length: result.repetitions }, (_, repetition) => {
          const startMs = result.firstRepetitionStartMs + repetition * result.patternMs
          const positionOf = (timeMs: number) => (timeMs - startMs) / result.patternMs
          return trackIds.map((trackId) => (
            <div key={`${repetition}-${trackId}`} className="result-repetition">
              <span className="muted">
                {trackIds.length > 1 ? `${trackId === 'left' ? 'L' : 'R'}${repetition + 1}` : repetition + 1}
              </span>
              <TimingTrack
                targets={result.expectedEvents.filter((event) => event.repetition === repetition && event.trackId === trackId)}
                judgements={judgements.filter((judgement) => {
                  if (judgement.kind !== 'extra') {
                    return judgement.expected.repetition === repetition && judgement.expected.trackId === trackId
                  }
                  const position = positionOf(judgement.tap.timeMs)
                  return judgement.tap.trackId === trackId && position >= -0.05 && position < 0.98
                })}
                positionOf={(timeMs) => positionToX(positionOf(timeMs))}
              />
            </div>
          ))
        })}
      </section>
      )}

      <div className="button-row">
        {result.passed && onNext ? (
          <>
            <button type="button" className="primary-button" onClick={onNext}>
              {nextLabel}
            </button>
            <button type="button" className="secondary-button" onClick={onRetry}>
              이 패턴 다시
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary-button" onClick={onRetry}>
              다시 도전
            </button>
            {onNext && (
              <button type="button" className="secondary-button" onClick={onNext}>
                {nextLabel}
              </button>
            )}
          </>
        )}
        <button type="button" className="secondary-button" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  )
}
