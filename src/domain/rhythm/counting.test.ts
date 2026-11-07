import { describe, expect, it } from 'vitest'
import { createFraction } from './fraction.ts'

const quarterBeat = createFraction(1, 4)

describe('objectParticle', () => {
  it('picks 을 or 를 by the final sound', async () => {
    const { objectParticle } = await import('./counting.ts')
    expect(objectParticle('2박')).toBe('을')
    expect(objectParticle('2박의 &')).toBe('을')
    expect(objectParticle('2박의 e')).toBe('를')
    expect(objectParticle('이 음표')).toBe('를')
  })
})

describe('describePosition', () => {
  it('names a position for messages', async () => {
    const { describePosition } = await import('./counting.ts')
    expect(describePosition(createFraction(3, 8), quarterBeat)).toBe('2박의 &')
    expect(describePosition(createFraction(1, 2), quarterBeat)).toBe('3박')
  })
})
