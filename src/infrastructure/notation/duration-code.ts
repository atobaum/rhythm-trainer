import { compareFractions, createFraction, multiplyFractions } from '../../domain/rhythm/fraction.ts'
import type { Fraction } from '../../domain/rhythm/fraction.ts'
import type { Tuplet } from '../../domain/rhythm/pattern.ts'

export type NotationDuration = {
  code: string
  dots: number
}

const BASE_VALUES: { code: string; value: Fraction }[] = [
  { code: 'w', value: createFraction(1, 1) },
  { code: 'h', value: createFraction(1, 2) },
  { code: 'q', value: createFraction(1, 4) },
  { code: '8', value: createFraction(1, 8) },
  { code: '16', value: createFraction(1, 16) },
  { code: '32', value: createFraction(1, 32) },
]

const DOT_MULTIPLIERS = [createFraction(1, 1), createFraction(3, 2), createFraction(7, 4)]

export function toNotationDuration(duration: Fraction, tuplet?: Tuplet): NotationDuration | null {
  const written = tuplet ? multiplyFractions(duration, createFraction(tuplet.actual, tuplet.normal)) : duration
  for (const base of BASE_VALUES) {
    for (const [dots, multiplier] of DOT_MULTIPLIERS.entries()) {
      if (compareFractions(multiplyFractions(base.value, multiplier), written) === 0) {
        return { code: base.code, dots }
      }
    }
  }
  return null
}
