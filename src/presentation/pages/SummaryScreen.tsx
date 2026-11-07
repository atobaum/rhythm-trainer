import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import ScoreView from '../components/ScoreView.tsx'

export type PatternOutcome = {
  pattern: RhythmPattern
  passed: boolean
  repetitionsPlayed: number
  stars: number
  bpm: number
  label?: string
}

export type SummaryAction = {
  label: string
  onClick: () => void
  primary?: boolean
}

type Props = {
  heading: string
  title: string
  outcomes: PatternOutcome[]
  extra?: string
  actions: SummaryAction[]
}

export default function SummaryScreen({ heading, title, outcomes, extra, actions }: Props) {
  const passedCount = outcomes.filter((outcome) => outcome.passed).length
  const totalRepetitions = outcomes.reduce((sum, outcome) => sum + outcome.repetitionsPlayed, 0)

  return (
    <div className="result">
      <h2 className="result-title">{heading}</h2>
      <p className="result-subtitle">{title}</p>
      <p className="muted">
        {outcomes.length}개 중 {passedCount}개 통과 · 모두 {totalRepetitions}번 반복
      </p>
      {extra && <p className="insight">{extra}</p>}
      <div className="summary-list">
        {outcomes.map((outcome, index) => (
          <div key={`${outcome.pattern.id}-${index}`} className="summary-item">
            <div className="summary-item-header">
              <strong>{index + 1}.</strong>
              {outcome.label && <span className="kind-badge">{outcome.label}</span>}
              <span className="stars">
                {'★'.repeat(outcome.stars)}
                {'☆'.repeat(5 - outcome.stars)}
              </span>
              <span className="muted small">
                {outcome.passed ? `${outcome.repetitionsPlayed}번 만에 통과` : '건너뜀'} · {outcome.bpm} BPM
              </span>
            </div>
            <ScoreView pattern={outcome.pattern} />
          </div>
        ))}
      </div>
      <div className="button-row">
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            className={action.primary ? 'primary-button' : 'secondary-button'}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
