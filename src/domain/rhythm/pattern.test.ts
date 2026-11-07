import { describe, expect, it } from 'vitest'
import { createFraction } from './fraction.ts'
import { parsePattern, patternLength, validatePattern } from './pattern.ts'
import type { RhythmEvent, RhythmPattern } from './pattern.ts'

function event(id: string, onset: string, duration: string, kind: 'note' | 'rest' = 'note'): RhythmEvent {
  const [onsetNumerator, onsetDenominator = '1'] = onset.split('/')
  const [durationNumerator, durationDenominator = '1'] = duration.split('/')
  return {
    id,
    onset: createFraction(Number(onsetNumerator), Number(onsetDenominator)),
    duration: createFraction(Number(durationNumerator), Number(durationDenominator)),
    kind,
    notation: { dots: 0 },
  }
}

function singleTrackPattern(events: RhythmEvent[], bars = 1): RhythmPattern {
  return {
    id: 'test',
    title: 'test',
    timeSignature: { numerator: 4, denominator: 4 },
    bars,
    tracks: [{ id: 'main', role: 'single', instrument: 'tap', events }],
    tags: [],
    difficulty: 1,
  }
}

const quarterNotes = [event('a', '0', '1/4'), event('b', '1/4', '1/4'), event('c', '1/2', '1/4'), event('d', '3/4', '1/4')]

describe('patternLength', () => {
  it('is bars times the time signature in whole notes', () => {
    expect(patternLength(singleTrackPattern(quarterNotes, 2))).toEqual(createFraction(2, 1))
    expect(
      patternLength({ ...singleTrackPattern(quarterNotes), timeSignature: { numerator: 3, denominator: 4 } }),
    ).toEqual(createFraction(3, 4))
  })
})

describe('validatePattern', () => {
  it('accepts a 4/4 bar whose notes and rests sum to exactly one bar', () => {
    const events = [
      event('a', '0', '1/4'),
      event('b', '1/4', '1/8'),
      event('c', '3/8', '1/8', 'rest'),
      event('d', '1/2', '1/16'),
      event('e', '9/16', '3/16'),
      event('f', '3/4', '1/4', 'rest'),
    ]
    expect(validatePattern(singleTrackPattern(events))).toEqual([])
  })

  it('rejects a track that does not fill the bar', () => {
    const errors = validatePattern(singleTrackPattern(quarterNotes.slice(0, 3)))
    expect(errors.some((error) => error.includes('끝'))).toBe(true)
  })

  it('rejects a gap between events', () => {
    const errors = validatePattern(singleTrackPattern([event('a', '0', '1/4'), event('b', '1/2', '1/2')]))
    expect(errors.some((error) => error.includes('빈틈'))).toBe(true)
  })

  it('rejects overlapping events', () => {
    const errors = validatePattern(
      singleTrackPattern([event('a', '0', '1/2'), event('b', '1/4', '1/4'), event('c', '1/2', '1/2')]),
    )
    expect(errors.some((error) => error.includes('겹'))).toBe(true)
  })

  it('rejects an event that runs past the pattern', () => {
    const errors = validatePattern(singleTrackPattern([event('a', '0', '3/4'), event('b', '3/4', '1/2')]))
    expect(errors.some((error) => error.includes('넘'))).toBe(true)
  })

  it('rejects zero duration and unreduced fractions', () => {
    const zero = { ...event('a', '0', '1/4'), duration: { numerator: 0, denominator: 1 } }
    const unreduced = { ...event('b', '1/4', '3/4'), onset: { numerator: 2, denominator: 8 } }
    const errors = validatePattern(singleTrackPattern([zero, unreduced]))
    expect(errors.some((error) => error.includes('길이'))).toBe(true)
    expect(errors.some((error) => error.includes('기약분수'))).toBe(true)
  })

  it('rejects a tie group that contains a rest or is not contiguous', () => {
    const tiedRest = [
      { ...event('a', '0', '1/2'), notation: { dots: 0, tieGroupId: 't' } },
      { ...event('b', '1/2', '1/2', 'rest'), notation: { dots: 0, tieGroupId: 't' } },
    ]
    expect(validatePattern(singleTrackPattern(tiedRest)).some((error) => error.includes('붙임줄'))).toBe(true)

    const split = [
      { ...event('a', '0', '1/4'), notation: { dots: 0, tieGroupId: 't' } },
      event('b', '1/4', '1/4'),
      { ...event('c', '1/2', '1/2'), notation: { dots: 0, tieGroupId: 't' } },
    ]
    expect(validatePattern(singleTrackPattern(split)).some((error) => error.includes('붙임줄'))).toBe(true)
  })

  it('rejects duplicate event ids and invalid bars', () => {
    const duplicated = [event('a', '0', '1/2'), event('a', '1/2', '1/2')]
    expect(validatePattern(singleTrackPattern(duplicated)).some((error) => error.includes('중복'))).toBe(true)
    expect(validatePattern(singleTrackPattern(quarterNotes, 0)).some((error) => error.includes('마디'))).toBe(true)
  })
})

describe('parsePattern', () => {
  const content = {
    id: 'quarter-notes',
    title: '4분음표',
    timeSignature: { numerator: 4, denominator: 4 },
    bars: 1,
    tags: ['quarter-note'],
    difficulty: 1,
    tracks: [
      {
        id: 'main',
        role: 'single',
        instrument: 'tap',
        events: [
          { id: 'a', onset: '0', duration: '1/4', kind: 'note' },
          { id: 'b', onset: '1/4', duration: '1/4', kind: 'note' },
          { id: 'c', onset: '1/2', duration: '1/4', kind: 'rest' },
          { id: 'd', onset: '3/4', duration: '1/4', kind: 'note', accent: true },
        ],
      },
    ],
  }

  it('turns content JSON with fraction strings into a valid pattern', () => {
    const pattern = parsePattern(content)
    expect(pattern.tracks[0].events[1].onset).toEqual(createFraction(1, 4))
    expect(pattern.tracks[0].events[0].notation.dots).toBe(0)
    expect(pattern.tracks[0].events[3].articulation?.accent).toBe(true)
  })

  it('throws when the pattern breaks an invariant', () => {
    const broken = structuredClone(content)
    broken.tracks[0].events.pop()
    expect(() => parsePattern(broken)).toThrow(/quarter-notes/)
  })

  it('throws on malformed input', () => {
    expect(() => parsePattern({ id: 'x' })).toThrow()
    expect(() => parsePattern(null)).toThrow()
  })
})
