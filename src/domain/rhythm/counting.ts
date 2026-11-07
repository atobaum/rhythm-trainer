import { createFraction, multiplyFractions } from './fraction.ts'
import type { Fraction } from './fraction.ts'

const SUBDIVISION_LABELS = ['', 'e', '&', 'a']

function sixteenthPosition(onsetInBar: Fraction, beatLength: Fraction): { beat: number; subdivision: number } | null {
  const inBeats = multiplyFractions(onsetInBar, createFraction(beatLength.denominator, beatLength.numerator))
  const inQuarterBeats = multiplyFractions(inBeats, createFraction(4, 1))
  if (inQuarterBeats.denominator !== 1) {
    return null
  }
  return { beat: Math.floor(inQuarterBeats.numerator / 4) + 1, subdivision: inQuarterBeats.numerator % 4 }
}

const FINAL_CONSONANT_BY_SYMBOL: Record<string, boolean> = {
  '&': true,
  e: false,
  a: false,
  '0': true,
  '1': true,
  '2': false,
  '3': true,
  '4': false,
  '5': false,
  '6': true,
  '7': true,
  '8': true,
  '9': false,
}

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3
const FINAL_CONSONANT_COUNT = 28

export function objectParticle(word: string): '을' | '를' {
  const last = word.at(-1) ?? ''
  const code = last.charCodeAt(0)
  const hasFinalConsonant =
    code >= HANGUL_START && code <= HANGUL_END
      ? (code - HANGUL_START) % FINAL_CONSONANT_COUNT !== 0
      : (FINAL_CONSONANT_BY_SYMBOL[last] ?? false)
  return hasFinalConsonant ? '을' : '를'
}

export function describePosition(onsetInBar: Fraction, beatLength: Fraction): string | null {
  const position = sixteenthPosition(onsetInBar, beatLength)
  if (position === null) {
    return null
  }
  return position.subdivision === 0 ? `${position.beat}박` : `${position.beat}박의 ${SUBDIVISION_LABELS[position.subdivision]}`
}
