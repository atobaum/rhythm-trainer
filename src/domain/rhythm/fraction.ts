export type Fraction = {
  numerator: number
  denominator: number
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    ;[x, y] = [y, x % y]
  }
  return x
}

export function createFraction(numerator: number, denominator: number): Fraction {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error(`분자와 분모는 정수여야 합니다: ${numerator}/${denominator}`)
  }
  if (denominator === 0) {
    throw new Error('분모는 0일 수 없습니다')
  }
  if (numerator === 0) {
    return { numerator: 0, denominator: 1 }
  }
  const sign = denominator < 0 ? -1 : 1
  const divisor = greatestCommonDivisor(numerator, denominator)
  return {
    numerator: (sign * numerator) / divisor,
    denominator: Math.abs(denominator) / divisor,
  }
}

export function isNormalizedFraction(fraction: Fraction): boolean {
  const { numerator, denominator } = fraction
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    return false
  }
  if (numerator === 0) {
    return denominator === 1
  }
  return greatestCommonDivisor(numerator, denominator) === 1
}

export function addFractions(left: Fraction, right: Fraction): Fraction {
  return createFraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

export function subtractFractions(left: Fraction, right: Fraction): Fraction {
  return addFractions(left, { numerator: -right.numerator, denominator: right.denominator })
}

export function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  return createFraction(left.numerator * right.numerator, left.denominator * right.denominator)
}

export function compareFractions(left: Fraction, right: Fraction): number {
  return left.numerator * right.denominator - right.numerator * left.denominator
}

export function fractionToNumber(fraction: Fraction): number {
  return fraction.numerator / fraction.denominator
}

const FRACTION_PATTERN = /^(-?\d+)(?:\/(\d+))?$/

export function parseFraction(text: string): Fraction {
  const match = FRACTION_PATTERN.exec(text.trim())
  if (!match) {
    throw new Error(`분수 형식이 아닙니다: "${text}"`)
  }
  const numerator = Number(match[1])
  const denominator = match[2] === undefined ? 1 : Number(match[2])
  return createFraction(numerator, denominator)
}

export function formatFraction(fraction: Fraction): string {
  return fraction.denominator === 1 ? `${fraction.numerator}` : `${fraction.numerator}/${fraction.denominator}`
}
