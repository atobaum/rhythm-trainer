import type { Judgement } from '../../domain/evaluation/matcher.ts'
import type { ExpectedEvent } from '../../domain/rhythm/event-generator.ts'
import { MARK_SYMBOLS, markOf } from './judgement-style.ts'

type Props = {
  targets: ExpectedEvent[]
  judgements: Judgement[]
  pendingTapPositions?: number[]
  positionOf: (timeMs: number) => number
  cursor?: number | null
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export default function TimingTrack({ targets, judgements, pendingTapPositions = [], positionOf, cursor = null }: Props) {
  return (
    <div className="timing-track">
      {targets.map((target) => (
        <div key={target.id} className="timing-target" style={{ left: `${clamp(positionOf(target.targetTimeMs)) * 100}%` }} />
      ))}
      {judgements.map((judgement) => {
        const mark = markOf(judgement)
        const timeMs = judgement.kind === 'miss' ? judgement.expected.targetTimeMs : judgement.tap.timeMs
        const key = judgement.kind === 'miss' ? `miss-${judgement.expected.id}` : `tap-${judgement.tap.id}`
        return (
          <div key={key} className={`timing-mark mark-${mark}`} style={{ left: `${clamp(positionOf(timeMs)) * 100}%` }}>
            {MARK_SYMBOLS[mark]}
          </div>
        )
      })}
      {pendingTapPositions.map((position, index) => (
        <div key={`pending-${index}`} className="timing-mark mark-pending" style={{ left: `${clamp(position) * 100}%` }}>
          {MARK_SYMBOLS.pending}
        </div>
      ))}
      {cursor !== null && <div className="strip-cursor" style={{ left: `${cursor * 100}%` }} />}
    </div>
  )
}
