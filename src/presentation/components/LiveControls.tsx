import { useState } from 'react'
import type { GuideMode } from '../../application/practice-types.ts'

export type LiveChange = { bpm: number; guide: GuideMode }

type Props = {
  current: LiveChange
  pending: LiveChange | null
  untilLabel: string
  onChange: (next: LiveChange | null) => void
}

const GUIDE_SHORT_LABELS: Record<GuideMode, string> = { 'every-beat': '매 박', 'first-beat': '첫 박만', gap: '1마디씩 끄기', none: '기준음 끔' }

const GUIDE_OPTIONS: { value: GuideMode; label: string }[] = [
  { value: 'every-beat', label: '기준음 매 박' },
  { value: 'first-beat', label: '기준음 첫 박만' },
  { value: 'gap', label: '기준음 1마디씩 끄기' },
  { value: 'none', label: '기준음 끔' },
]

const MINIMUM_BPM = 40
const MAXIMUM_BPM = 200
const BPM_STEP = 5

export default function LiveControls({ current, pending, untilLabel, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const target = pending ?? current
  const change = (next: LiveChange) => onChange(next.bpm === current.bpm && next.guide === current.guide ? null : next)
  const stepBpm = (direction: 1 | -1) =>
    change({ ...target, bpm: Math.min(MAXIMUM_BPM, Math.max(MINIMUM_BPM, target.bpm + direction * BPM_STEP)) })
  const summary = (
    <button type="button" className="live-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      {target.bpm} BPM · {GUIDE_SHORT_LABELS[target.guide]}
      {pending && <span className="live-pending"> · {untilLabel}부터</span>}
      <span aria-hidden="true"> {open ? '▴' : '▾'}</span>
    </button>
  )
  if (!open) {
    return <div className="live-controls">{summary}</div>
  }
  return (
    <div className="live-controls">
      {summary}
      <div className="live-row">
        <button type="button" className="secondary-button" onClick={() => stepBpm(-1)}>
          −5
        </button>
        <button type="button" className="secondary-button" onClick={() => stepBpm(1)}>
          +5
        </button>
        <select className="live-guide" value={target.guide} onChange={(event) => change({ ...target, guide: event.target.value as GuideMode })}>
          {GUIDE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
