import type { ScheduledSound } from './practice-types.ts'

type ReplayInput = {
  hitTimesMs: number[]
  performMs: number
  beatMs: number
  beatsPerBar: number
  kind?: 'tap' | 'note'
}

const OUT_OF_RANGE_MARGIN_MS = 500

export function buildReplaySounds({ hitTimesMs, performMs, beatMs, beatsPerBar, kind = 'tap' }: ReplayInput): ScheduledSound[] {
  const leadMs = beatMs * beatsPerBar
  const totalBeats = Math.round((leadMs + performMs) / beatMs)
  const clicks: ScheduledSound[] = Array.from({ length: totalBeats }, (_, beat) => ({
    timeMs: beat * beatMs,
    kind: beat % beatsPerBar === 0 ? 'accent' : 'beat',
  }))
  const hits: ScheduledSound[] = hitTimesMs
    .filter((timeMs) => timeMs >= -OUT_OF_RANGE_MARGIN_MS && timeMs <= performMs + OUT_OF_RANGE_MARGIN_MS)
    .map((timeMs) => ({ timeMs: leadMs + timeMs, kind }))
  return [...clicks, ...hits].sort((left, right) => left.timeMs - right.timeMs)
}
