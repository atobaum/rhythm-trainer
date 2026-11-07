import { describe, expect, it } from 'vitest'
import { parsePattern } from '../domain/rhythm/pattern.ts'
import { decidedVerdict, evaluateSlot } from './bar-flow-evaluation.ts'
import { buildBarFlowPlan } from './bar-flow-plan.ts'

const bar = parsePattern({
  id: 'bar',
  title: 'bar',
  timeSignature: { numerator: 4, denominator: 4 },
  bars: 1,
  tags: [],
  difficulty: 1,
  tracks: [
    {
      id: 'main',
      role: 'single',
      instrument: 'tap',
      events: [
        { id: 'a', onset: '0', duration: '1/2', kind: 'note' },
        { id: 'b', onset: '1/2', duration: '1/2', kind: 'note' },
      ],
    },
  ],
})

const reading = buildBarFlowPlan(4, 1, { mode: 'reading', bpm: 60, guide: 'every-beat' })
const tap = (timeMs: number, index = 0) => ({ id: `t${index}`, timeMs, trackId: 'main' })
const windowOf = (slot: number) => ({ startMs: reading.slotStartMs(slot), decisionMs: reading.decisionMs(slot) })

describe('buildBarFlowPlan', () => {
  it('starts after a one-bar count-in and lays bars back to back', () => {
    expect(reading.countInSounds).toHaveLength(4)
    expect(reading.slotStartMs(0)).toBe(4000)
    expect(reading.slotStartMs(2)).toBe(12000)
    expect(reading.slotAt(8100)).toBe(1)
    expect(reading.decisionMs(0)).toBe(8000 - 120)
    expect(reading.expectedForSlot(1, bar).map((event) => event.targetTimeMs)).toEqual([8000, 10000])
  })

  it('lets imitation listen only before the first try of a unit', () => {
    const imitation = buildBarFlowPlan(4, 1, { mode: 'imitation', bpm: 60, guide: 'none' })
    expect(imitation.slotsForUnit(0, true).map((slot) => slot.kind)).toEqual(['listen', 'play'])
    expect(imitation.slotsForUnit(0, false).map((slot) => slot.kind)).toEqual(['play'])
    const [listen, play] = imitation.slotsForUnit(0, true)
    expect(imitation.soundsForSlot(0, listen, bar).filter((sound) => sound.kind === 'note').map((sound) => sound.timeMs)).toEqual([4000, 6000])
    expect(imitation.soundsForSlot(0, listen, bar).filter((sound) => sound.kind !== 'note')).toHaveLength(4)
    expect(imitation.soundsForSlot(1, play, bar)).toEqual([])
    expect(reading.slotsForUnit(0, true).map((slot) => slot.kind)).toEqual(['play'])
  })

  it('makes two-bar slots after a one-bar count-in and mutes the second bar in the gap guide', () => {
    const gap = buildBarFlowPlan(4, 2, { mode: 'reading', bpm: 60, guide: 'gap' })
    expect(gap.countInSounds).toHaveLength(4)
    expect([gap.slotStartMs(0), gap.slotStartMs(1), gap.decisionMs(0)]).toEqual([4000, 12000, 11880])
    expect(gap.slotAt(11999)).toBe(0)
    const [play] = gap.slotsForUnit(0, true)
    expect(gap.soundsForSlot(1, play, bar).map((sound) => sound.timeMs)).toEqual([12000, 13000, 14000, 15000])
    expect(gap.isMutedBar(play, 1)).toBe(true)
  })
})

describe('evaluateSlot', () => {
  const expected = reading.expectedForSlot(0, bar)

  it('stays pending while correct and becomes clean at the boundary', () => {
    const taps = [tap(4010), tap(6000, 1)]
    expect(evaluateSlot(expected, taps, windowOf(0), 6500).verdict).toBe('pending')
    expect(evaluateSlot(expected, taps, windowOf(0), 7880).verdict).toBe('clean')
  })

  it('asks for a retry as soon as a note is missed', () => {
    expect(evaluateSlot(expected, [], windowOf(0), 4100).verdict).toBe('pending')
    expect(evaluateSlot(expected, [], windowOf(0), 4130).verdict).toBe('retry')
  })

  it('asks for a retry as soon as an extra tap lands', () => {
    expect(evaluateSlot(expected, [tap(4000), tap(5000, 1)], windowOf(0), 5001).verdict).toBe('retry')
  })

  it('leaves an early tap for the next bar out of this bar', () => {
    const taps = [tap(4000), tap(6000, 1), tap(7950, 2)]
    expect(evaluateSlot(expected, taps, windowOf(0), 7960).verdict).toBe('clean')
    expect(evaluateSlot(reading.expectedForSlot(1, bar), taps, windowOf(1), 8050).judgements[0]).toMatchObject({ kind: 'hit' })
  })

  it('retries a bar whose mean error is too large', () => {
    expect(evaluateSlot(expected, [tap(4090), tap(6090, 1)], windowOf(0), 7880).verdict).toBe('retry')
  })

  it('schedules the melody of the unit with its pitch and length', () => {
    const melody = [[], [{ onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 2 }, frequency: 440 }]]
    const plan = buildBarFlowPlan(4, 1, { mode: 'reading', bpm: 60, guide: 'none' }, melody)
    expect(plan.soundsForSlot(0, { kind: 'play', unitIndex: 0 }, bar)).toEqual([])
    expect(plan.soundsForSlot(3, { kind: 'play', unitIndex: 1 }, bar)).toEqual([{ timeMs: 17000, kind: 'melody', frequency: 440, durationMs: 2000 }])
  })

  it('waits for the end of the slot before deciding a mistake in a continuous flow', () => {
    const early = evaluateSlot(reading.expectedForSlot(0, bar), [tap(4300)], windowOf(0), 5000)
    expect(early.verdict).toBe('retry')
    expect(decidedVerdict(early, windowOf(0), 5000, false)).toBe('retry')
    expect(decidedVerdict(early, windowOf(0), 5000, true)).toBeNull()
    const final = evaluateSlot(reading.expectedForSlot(0, bar), [tap(4300)], windowOf(0), 7900)
    expect(decidedVerdict(final, windowOf(0), 7900, true)).toBe('retry')
    expect(final.metrics.missCount).toBe(2)
  })
})
