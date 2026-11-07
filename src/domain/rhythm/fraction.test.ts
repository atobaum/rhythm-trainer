import { describe, expect, it } from 'vitest'
import {
  addFractions,
  compareFractions,
  createFraction,
  fractionToNumber,
  isNormalizedFraction,
  multiplyFractions,
  parseFraction,
  subtractFractions,
} from './fraction.ts'

describe('createFraction', () => {
  it('reduces to lowest terms', () => {
    expect(createFraction(2, 8)).toEqual({ numerator: 1, denominator: 4 })
  })

  it('moves the sign to the numerator', () => {
    expect(createFraction(1, -2)).toEqual({ numerator: -1, denominator: 2 })
  })

  it('normalizes zero to 0/1', () => {
    expect(createFraction(0, 5)).toEqual({ numerator: 0, denominator: 1 })
  })

  it('rejects a zero denominator', () => {
    expect(() => createFraction(1, 0)).toThrow()
  })

  it('rejects non-integers', () => {
    expect(() => createFraction(0.5, 2)).toThrow()
  })
})

describe('arithmetic', () => {
  it('adds', () => {
    expect(addFractions(createFraction(1, 3), createFraction(1, 6))).toEqual(createFraction(1, 2))
  })

  it('subtracts', () => {
    expect(subtractFractions(createFraction(1, 4), createFraction(1, 3))).toEqual(createFraction(-1, 12))
  })

  it('multiplies', () => {
    expect(multiplyFractions(createFraction(2, 3), createFraction(3, 4))).toEqual(createFraction(1, 2))
  })

  it('compares', () => {
    expect(compareFractions(createFraction(1, 3), createFraction(1, 4))).toBeGreaterThan(0)
    expect(compareFractions(createFraction(2, 8), createFraction(1, 4))).toBe(0)
    expect(compareFractions(createFraction(1, 8), createFraction(1, 4))).toBeLessThan(0)
  })

  it('converts to a number', () => {
    expect(fractionToNumber(createFraction(3, 8))).toBe(0.375)
  })
})

describe('parseFraction', () => {
  it('parses n/d strings', () => {
    expect(parseFraction('3/8')).toEqual({ numerator: 3, denominator: 8 })
    expect(parseFraction('2/4')).toEqual({ numerator: 1, denominator: 2 })
  })

  it('parses integers', () => {
    expect(parseFraction('0')).toEqual({ numerator: 0, denominator: 1 })
    expect(parseFraction('2')).toEqual({ numerator: 2, denominator: 1 })
  })

  it('rejects malformed input', () => {
    expect(() => parseFraction('1/')).toThrow()
    expect(() => parseFraction('a/4')).toThrow()
    expect(() => parseFraction('1.5')).toThrow()
  })
})

describe('isNormalizedFraction', () => {
  it('detects unreduced and invalid fractions', () => {
    expect(isNormalizedFraction({ numerator: 1, denominator: 4 })).toBe(true)
    expect(isNormalizedFraction({ numerator: 2, denominator: 8 })).toBe(false)
    expect(isNormalizedFraction({ numerator: 1, denominator: 0 })).toBe(false)
    expect(isNormalizedFraction({ numerator: 1, denominator: -4 })).toBe(false)
  })
})
