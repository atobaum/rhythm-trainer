import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from './event-generator.ts'
import { formatFraction } from './fraction.ts'
import { validatePattern } from './pattern.ts'
import { createPolyrhythmPattern } from './polyrhythm.ts'

function onsetsByTrack(left: number, right: number) {
  const pattern = createPolyrhythmPattern(left, right)
  return Object.fromEntries(
    pattern.tracks.map((track) => [track.role, track.events.map((event) => formatFraction(event.onset))]),
  )
}

describe('createPolyrhythmPattern', () => {
  it('splits one 4/4 bar 2:3', () => {
    expect(onsetsByTrack(2, 3)).toEqual({ left: ['0', '1/2'], right: ['0', '1/3', '2/3'] })
  })

  it('splits one 4/4 bar 3:4', () => {
    expect(onsetsByTrack(3, 4)).toEqual({ left: ['0', '1/3', '2/3'], right: ['0', '1/4', '1/2', '3/4'] })
  })

  it('produces a valid pattern with tuplet notation for non power-of-two splits', () => {
    const pattern = createPolyrhythmPattern(4, 5)
    expect(validatePattern(pattern)).toEqual([])
    const [left, right] = pattern.tracks
    expect(left.events[0].notation.tuplet).toBeUndefined()
    expect(right.events[0].notation.tuplet).toEqual({ actual: 5, normal: 4 })
  })

  it('keeps both hands together at every cycle start over 100 cycles', () => {
    const events = generateExpectedEvents(createPolyrhythmPattern(3, 4), { bpm: 113, repetitions: 100 })
    for (let cycle = 0; cycle < 100; cycle++) {
      const downbeats = events.filter((event) => event.repetition === cycle && event.onset.numerator === 0)
      expect(downbeats).toHaveLength(2)
      expect(downbeats[0].targetTimeMs).toBe(downbeats[1].targetTimeMs)
    }
  })

  it('rejects ratios that are not positive integers', () => {
    expect(() => createPolyrhythmPattern(0, 3)).toThrow()
    expect(() => createPolyrhythmPattern(2, 2.5)).toThrow()
  })
})
