import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from './event-generator.ts'
import { parsePattern, validatePattern } from './pattern.ts'

function twoHandContent(leftRole = 'left', rightRole = 'right') {
  return {
    id: 'two-hand',
    title: 'two hand',
    timeSignature: { numerator: 4, denominator: 4 },
    bars: 1,
    tags: ['two-hand'],
    difficulty: 1,
    tracks: [
      {
        id: 'left',
        role: leftRole,
        instrument: 'tap',
        events: [
          { id: 'l1', onset: '0', duration: '1/2', kind: 'note' },
          { id: 'l2', onset: '1/2', duration: '1/2', kind: 'note' },
        ],
      },
      {
        id: 'right',
        role: rightRole,
        instrument: 'tap',
        events: [
          { id: 'r1', onset: '0', duration: '1/4', kind: 'note' },
          { id: 'r2', onset: '1/4', duration: '1/4', kind: 'rest' },
          { id: 'r3', onset: '1/2', duration: '1/4', kind: 'note' },
          { id: 'r4', onset: '3/4', duration: '1/4', kind: 'note' },
        ],
      },
    ],
  }
}

describe('multiple tracks', () => {
  it('generates events per track, ordered by time', () => {
    const events = generateExpectedEvents(parsePattern(twoHandContent()), { bpm: 60 })
    expect(events.map((event) => [event.trackId, event.targetTimeMs])).toEqual([
      ['left', 0],
      ['right', 0],
      ['left', 2000],
      ['right', 2000],
      ['right', 3000],
    ])
  })

  it('requires distinct hand roles when there is more than one track', () => {
    const pattern = parsePattern(twoHandContent())
    const bothLeft = { ...pattern, tracks: pattern.tracks.map((track) => ({ ...track, role: 'left' as const })) }
    expect(validatePattern(bothLeft).some((error) => error.includes('역할'))).toBe(true)

    const single = { ...pattern, tracks: [pattern.tracks[0], { ...pattern.tracks[1], role: 'single' as const }] }
    expect(validatePattern(single).some((error) => error.includes('역할'))).toBe(true)
  })
})

describe('tuplets', () => {
  it('places triplet eighths at thirds of a beat', () => {
    const pattern = parsePattern({
      id: 'triplet',
      title: 'triplet',
      timeSignature: { numerator: 4, denominator: 4 },
      bars: 1,
      tags: ['triplet'],
      difficulty: 1,
      tracks: [
        {
          id: 'main',
          role: 'single',
          instrument: 'tap',
          events: [
            { id: 't1', onset: '0', duration: '1/12', kind: 'note', tuplet: { actual: 3, normal: 2 } },
            { id: 't2', onset: '1/12', duration: '1/12', kind: 'note', tuplet: { actual: 3, normal: 2 } },
            { id: 't3', onset: '1/6', duration: '1/12', kind: 'note', tuplet: { actual: 3, normal: 2 } },
            { id: 'rest', onset: '1/4', duration: '3/4', kind: 'rest' },
          ],
        },
      ],
    })
    const times = generateExpectedEvents(pattern, { bpm: 60 }).map((event) => event.targetTimeMs)
    expect(times[0]).toBe(0)
    expect(times[1]).toBeCloseTo(1000 / 3, 6)
    expect(times[2]).toBeCloseTo(2000 / 3, 6)
  })
})
