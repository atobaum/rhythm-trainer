import type { Judgement } from '../../domain/evaluation/matcher.ts'
import { MARK_LABELS, describeError, markOf } from './judgement-style.ts'

type Props = {
  recent: Judgement[]
  rangeMs?: number
}

export default function ErrorMeter({ recent, rangeMs = 150 }: Props) {
  const last = recent[recent.length - 1]
  const position = (errorMs: number) => 50 + (Math.max(-rangeMs, Math.min(rangeMs, errorMs)) / rangeMs) * 50

  return (
    <div className="error-meter">
      <div className="error-meter-label">
        {last === undefined ? (
          <span className="muted">탭하면 오차가 여기에 나와요</span>
        ) : last.kind === 'hit' ? (
          <>
            <strong className={`mark-text-${last.grade}`}>{MARK_LABELS[last.grade]}</strong> {describeError(last.errorMs)}
            {last.wrongDirection && <strong className="mark-text-direction"> · 방향 반대</strong>}
          </>
        ) : (
          <strong className={`mark-text-${markOf(last)}`}>{last.kind === 'extra' ? 'Extra 칠 곳이 아니에요' : 'Miss'}</strong>
        )}
      </div>
      <div className="error-meter-scale">
        <span className="error-meter-side">빠름</span>
        <div className="error-meter-bar">
          <div className="error-meter-zone zone-good" />
          <div className="error-meter-zone zone-great" />
          <div className="error-meter-zone zone-perfect" />
          <div className="error-meter-center" />
          {recent.map((judgement, index) =>
            judgement.kind === 'hit' ? (
              <div
                key={judgement.tap.id}
                className={`error-meter-dot mark-${judgement.grade}`}
                style={{ left: `${position(judgement.errorMs)}%`, opacity: (index + 1) / recent.length }}
              />
            ) : null,
          )}
        </div>
        <span className="error-meter-side">늦음</span>
      </div>
    </div>
  )
}
