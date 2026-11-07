import { addFractions, compareFractions, createFraction, multiplyFractions } from './fraction.ts'
import type { Fraction } from './fraction.ts'
import { patternLength } from './pattern.ts'
import type { RhythmEvent, RhythmPattern, StrumDirection } from './pattern.ts'

export type ExpectedEvent = {
  id: string
  patternEventId: string
  trackId: string
  repetition: number
  onset: Fraction
  targetTimeMs: number
  direction?: StrumDirection
  accent?: boolean
}

export type EventGenerationOptions = {
  bpm: number
  startTimeMs?: number
  repetitions?: number
}

const MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM = 240000

function startsAStroke(event: RhythmEvent, previous: RhythmEvent | undefined): boolean {
  if (event.kind !== 'note' || event.strum?.motion === 'ghost') {
    return false
  }
  const tieGroupId = event.notation.tieGroupId
  return tieGroupId === undefined || previous?.notation.tieGroupId !== tieGroupId
}

export function generateExpectedEvents(pattern: RhythmPattern, options: EventGenerationOptions): ExpectedEvent[] {
  const { bpm, startTimeMs = 0, repetitions = 1 } = options
  if (!(bpm > 0)) {
    throw new Error(`BPM 은 0보다 커야 합니다: ${bpm}`)
  }
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`반복 횟수는 1 이상의 정수여야 합니다: ${repetitions}`)
  }

  const length = patternLength(pattern)
  const millisecondsPerWholeNote = MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM / bpm
  const events: ExpectedEvent[] = []

  for (let repetition = 0; repetition < repetitions; repetition++) {
    const repetitionStart = multiplyFractions(createFraction(repetition, 1), length)
    for (const track of pattern.tracks) {
      const sorted = [...track.events].sort((left, right) => compareFractions(left.onset, right.onset))
      sorted.forEach((event, index) => {
        if (!startsAStroke(event, sorted[index - 1])) {
          return
        }
        const position = addFractions(repetitionStart, event.onset)
        events.push({
          id: `${track.id}:${event.id}:${repetition}`,
          patternEventId: event.id,
          trackId: track.id,
          repetition,
          onset: event.onset,
          targetTimeMs: startTimeMs + (position.numerator * millisecondsPerWholeNote) / position.denominator,
          direction: event.strum?.direction,
          ...(event.articulation?.accent ? { accent: true } : {}),
        })
      })
    }
  }

  return events.sort((left, right) => left.targetTimeMs - right.targetTimeMs || left.trackId.localeCompare(right.trackId))
}
