import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from './event-generator.ts'
import { parsePattern } from './pattern.ts'

type ContentEvent = Record<string, unknown> & { id: string; onset: string; duration: string; kind: 'note' | 'rest' }

function pattern(events: ContentEvent[]) {
  return parsePattern({
    id: 'test',
    title: 'test',
    timeSignature: { numerator: 4, denominator: 4 },
    bars: 1,
    tags: [],
    difficulty: 1,
    tracks: [{ id: 'main', role: 'single', instrument: 'tap', events }],
  })
}

const eighthNotes = pattern([
  { id: 'a', onset: '0', duration: '1/8', kind: 'note' },
  { id: 'b', onset: '1/8', duration: '1/8', kind: 'note' },
  { id: 'c', onset: '1/4', duration: '1/8', kind: 'note' },
  { id: 'd', onset: '3/8', duration: '1/8', kind: 'note' },
  { id: 'e', onset: '1/2', duration: '1/2', kind: 'rest' },
])

describe('generateExpectedEvents', () => {
  it('places 80 BPM eighth notes 375ms apart', () => {
    const times = generateExpectedEvents(eighthNotes, { bpm: 80 }).map((event) => event.targetTimeMs)
    expect(times).toEqual([0, 375, 750, 1125])
  })

  it('offsets by the start time', () => {
    const times = generateExpectedEvents(eighthNotes, { bpm: 80, startTimeMs: 1000 }).map((event) => event.targetTimeMs)
    expect(times).toEqual([1000, 1375, 1750, 2125])
  })

  it('creates no event for rests', () => {
    const events = generateExpectedEvents(eighthNotes, { bpm: 80 })
    expect(events.map((event) => event.patternEventId)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('creates one event for a tie group', () => {
    const tied = pattern([
      { id: 'a', onset: '0', duration: '1/4', kind: 'note' },
      { id: 'b', onset: '1/4', duration: '1/4', kind: 'note', tieGroupId: 't' },
      { id: 'c', onset: '1/2', duration: '1/4', kind: 'note', tieGroupId: 't' },
      { id: 'd', onset: '3/4', duration: '1/4', kind: 'note' },
    ])
    const events = generateExpectedEvents(tied, { bpm: 60 })
    expect(events.map((event) => [event.patternEventId, event.targetTimeMs])).toEqual([
      ['a', 0],
      ['b', 1000],
      ['d', 3000],
    ])
  })

  it('creates no event for ghost strums and keeps the direction of sounding strums', () => {
    const strums = pattern([
      { id: 'a', onset: '0', duration: '1/2', kind: 'note', strum: { direction: 'down', motion: 'sound' } },
      { id: 'b', onset: '1/2', duration: '1/2', kind: 'note', strum: { direction: 'up', motion: 'ghost' } },
    ])
    const events = generateExpectedEvents(strums, { bpm: 60 })
    expect(events).toHaveLength(1)
    expect(events[0].direction).toBe('down')
  })

  it('repeats the pattern back to back', () => {
    const events = generateExpectedEvents(eighthNotes, { bpm: 80, repetitions: 2 })
    expect(events.map((event) => event.targetTimeMs)).toEqual([0, 375, 750, 1125, 3000, 3375, 3750, 4125])
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
    expect(events[4].repetition).toBe(1)
  })

  it('does not drift over 1000 repetitions', () => {
    const triplets = parsePattern({
      id: 'triplets',
      title: 'triplets',
      timeSignature: { numerator: 4, denominator: 4 },
      bars: 1,
      tags: [],
      difficulty: 1,
      tracks: [
        {
          id: 'main',
          role: 'single',
          instrument: 'tap',
          events: Array.from({ length: 12 }, (_, index) => ({
            id: `t${index}`,
            onset: `${index}/12`,
            duration: '1/12',
            kind: 'note',
            tuplet: { actual: 3, normal: 2 },
          })),
        },
      ],
    })
    const bpm = 97
    const events = generateExpectedEvents(triplets, { bpm, repetitions: 1000 })
    const last = events[events.length - 1]
    const exact = ((999 * 12 + 11) / 12) * (240000 / bpm)
    expect(Math.abs(last.targetTimeMs - exact)).toBeLessThan(1)
  })

  it('rejects a non-positive BPM or repetition count', () => {
    expect(() => generateExpectedEvents(eighthNotes, { bpm: 0 })).toThrow()
    expect(() => generateExpectedEvents(eighthNotes, { bpm: 80, repetitions: 0 })).toThrow()
  })
})
