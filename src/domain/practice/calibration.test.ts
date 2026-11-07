import { describe, expect, it } from 'vitest'
import { measureLatencyOffset } from './calibration.ts'

const beats = Array.from({ length: 16 }, (_, index) => 1000 + index * 600)

describe('measureLatencyOffset', () => {
  it('uses the median error of taps after the warm-up beats', () => {
    const taps = beats.map((target, index) => target + (index < 4 ? 200 : 40 + (index % 3) * 5))
    expect(measureLatencyOffset(beats, taps)).toEqual({ offsetMs: 45, tapCount: 12, spreadMs: 5 })
  })

  it('ignores taps that are far from any beat', () => {
    const taps = [...beats.map((target) => target + 30), 1300, 4900]
    expect(measureLatencyOffset(beats, taps)?.offsetMs).toBe(30)
  })

  it('handles early tappers with a negative offset', () => {
    expect(measureLatencyOffset(beats, beats.map((target) => target - 25))?.offsetMs).toBe(-25)
  })

  it('needs enough taps to trust the result', () => {
    expect(measureLatencyOffset(beats, beats.slice(0, 9).map((target) => target + 10))).toBeNull()
  })
})
