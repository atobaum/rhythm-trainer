import { describe, expect, it } from 'vitest'
import { createFraction } from '../rhythm/fraction.ts'
import type { ExpectedEvent } from '../rhythm/event-generator.ts'
import { classifyError, matchEvents } from './matcher.ts'
import type { Judgement, Tap } from './matcher.ts'
import { computeMetrics } from './metrics.ts'

function expected(times: number[], trackId = 'main'): ExpectedEvent[] {
  return times.map((targetTimeMs, index) => ({
    id: `${trackId}:e${index}:0`,
    patternEventId: `e${index}`,
    trackId,
    repetition: 0,
    onset: createFraction(index, 8),
    targetTimeMs,
  }))
}

function taps(times: number[], trackId = 'main'): Tap[] {
  return times.map((timeMs, index) => ({ id: `${trackId}:t${index}`, timeMs, trackId }))
}

function summary(judgements: Judgement[]) {
  return judgements.map((judgement) =>
    judgement.kind === 'hit'
      ? `hit ${judgement.expected.patternEventId}<-${judgement.tap.id.split(':')[1]} ${judgement.errorMs}`
      : judgement.kind === 'miss'
        ? `miss ${judgement.expected.patternEventId}`
        : `extra ${judgement.tap.id.split(':')[1]}`,
  )
}

const quarterNotesAt60 = expected([0, 1000, 2000, 3000])

describe('matchEvents', () => {
  it('matches accurate taps one to one', () => {
    expect(summary(matchEvents(quarterNotesAt60, taps([5, 990, 2000, 3020])))).toEqual([
      'hit e0<-t0 5',
      'hit e1<-t1 -10',
      'hit e2<-t2 0',
      'hit e3<-t3 20',
    ])
  })

  it('marks a tap on a rest as extra', () => {
    expect(summary(matchEvents(expected([0, 1000]), taps([0, 500, 1000])))).toEqual(['hit e0<-t0 0', 'extra t1', 'hit e1<-t2 0'])
  })

  it('marks an untouched target as miss', () => {
    expect(summary(matchEvents(expected([0, 1000]), taps([0])))).toEqual(['hit e0<-t0 0', 'miss e1'])
  })

  it('matches only one of two taps on the same target', () => {
    expect(summary(matchEvents(expected([0, 1000]), taps([990, 1010])))).toEqual(['miss e0', 'hit e1<-t0 -10', 'extra t1'])
  })

  it('does not shift later matches after a missed target', () => {
    expect(summary(matchEvents(quarterNotesAt60, taps([1000, 2000, 3000])))).toEqual([
      'miss e0',
      'hit e1<-t0 0',
      'hit e2<-t1 0',
      'hit e3<-t2 0',
    ])
  })

  it('keeps the sign of early and late taps', () => {
    const judgements = matchEvents(expected([1000, 2000]), taps([980, 2020]))
    expect(judgements.map((judgement) => (judgement.kind === 'hit' ? judgement.errorMs : null))).toEqual([-20, 20])
  })

  it('treats taps outside the window as extra', () => {
    expect(summary(matchEvents(expected([1000]), taps([1150])))).toEqual(['miss e0', 'extra t0'])
  })

  it('matches tracks independently', () => {
    const judgements = matchEvents(
      [...expected([0, 1000], 'left'), ...expected([0, 500, 1000], 'right')],
      [...taps([0, 1000], 'left'), ...taps([0, 500], 'right')],
    )
    expect(judgements.filter((judgement) => judgement.kind === 'hit')).toHaveLength(4)
    expect(judgements.filter((judgement) => judgement.kind === 'miss').map((judgement) => judgement.expected.trackId)).toEqual(['right'])
  })

  it('treats taps on an unknown track as extra', () => {
    expect(summary(matchEvents(expected([0]), taps([0], 'other')))).toEqual(['miss e0', 'extra t0'])
  })

  it('returns the same result for the same input', () => {
    const input = taps([12, 480, 1003, 1600, 2990])
    expect(matchEvents(quarterNotesAt60, input)).toEqual(matchEvents(quarterNotesAt60, input))
  })
})

describe('classifyError', () => {
  it('grades by absolute error', () => {
    expect(classifyError(-30)).toBe('perfect')
    expect(classifyError(31)).toBe('great')
    expect(classifyError(-70)).toBe('great')
    expect(classifyError(120)).toBe('good')
  })
})

describe('strum direction', () => {
  const strokes: ExpectedEvent[] = expected([0, 500]).map((event, index) => ({ ...event, direction: index === 0 ? 'down' : 'up' }))

  it('counts a wrong direction separately from timing', () => {
    const judgements = matchEvents(strokes, [
      { id: 't0', timeMs: 10, trackId: 'main', direction: 'down' },
      { id: 't1', timeMs: 500, trackId: 'main', direction: 'down' },
    ])
    expect(judgements.map((judgement) => judgement.kind === 'hit' && judgement.wrongDirection)).toEqual([false, true])
    const metrics = computeMetrics(judgements)
    expect(metrics.hitCount).toBe(2)
    expect(metrics.directionErrorCount).toBe(1)
  })

  it('ignores direction for plain taps', () => {
    const metrics = computeMetrics(matchEvents(strokes, taps([0, 500])))
    expect(metrics.directionErrorCount).toBe(0)
  })
})

describe('computeMetrics', () => {
  it('summarizes hits, misses and extras', () => {
    const metrics = computeMetrics(matchEvents(quarterNotesAt60, taps([-20, 1040, 1500, 3000])))
    expect(metrics).toEqual({
      expectedCount: 4,
      hitCount: 3,
      missCount: 1,
      extraCount: 1,
      directionErrorCount: 0,
      hitRate: 0.75,
      meanAbsoluteErrorMs: 20,
      meanSignedErrorMs: 20 / 3,
    })
  })

  it('reports null errors when nothing was hit', () => {
    const metrics = computeMetrics(matchEvents(quarterNotesAt60, []))
    expect(metrics.meanAbsoluteErrorMs).toBeNull()
    expect(metrics.meanSignedErrorMs).toBeNull()
    expect(metrics.hitRate).toBe(0)
  })
})
