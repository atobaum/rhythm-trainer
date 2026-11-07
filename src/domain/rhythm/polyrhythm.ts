import { createFraction } from './fraction.ts'
import type { RhythmEvent, RhythmPattern, RhythmTrack, Tuplet } from './pattern.ts'

export const POLYRHYTHM_PRESETS: [number, number][] = [
  [2, 3],
  [3, 2],
  [3, 4],
  [4, 3],
  [4, 5],
  [5, 4],
]

export const MAXIMUM_POLYRHYTHM_DIVISIONS = 9

function largestPowerOfTwoNotAbove(value: number): number {
  return 2 ** Math.floor(Math.log2(value))
}

function tupletForEvenSplit(divisions: number): Tuplet | undefined {
  const normal = largestPowerOfTwoNotAbove(divisions)
  return normal === divisions ? undefined : { actual: divisions, normal }
}

function evenlySplitTrack(role: 'left' | 'right', divisions: number): RhythmTrack {
  const tuplet = tupletForEvenSplit(divisions)
  const events: RhythmEvent[] = Array.from({ length: divisions }, (_, index) => ({
    id: `${role}${index + 1}`,
    onset: createFraction(index, divisions),
    duration: createFraction(1, divisions),
    kind: 'note',
    notation: tuplet ? { dots: 0, tuplet } : { dots: 0 },
  }))
  return { id: role, role, instrument: 'tap', events }
}

export function createPolyrhythmPattern(leftDivisions: number, rightDivisions: number): RhythmPattern {
  for (const divisions of [leftDivisions, rightDivisions]) {
    if (!Number.isInteger(divisions) || divisions < 1) {
      throw new Error(`폴리리듬 비율은 양의 정수여야 합니다: ${leftDivisions}:${rightDivisions}`)
    }
  }
  return {
    id: `polyrhythm-${leftDivisions}-${rightDivisions}`,
    title: `폴리리듬 ${leftDivisions}:${rightDivisions}`,
    timeSignature: { numerator: 4, denominator: 4 },
    bars: 1,
    tracks: [evenlySplitTrack('left', leftDivisions), evenlySplitTrack('right', rightDivisions)],
    tags: ['polyrhythm', 'two-hand'],
    difficulty: leftDivisions + rightDivisions,
  }
}
