import { describe, expect, it } from 'vitest'
import { createFraction } from '../../domain/rhythm/fraction.ts'
import { songUnits } from '../../domain/songs/song-pattern.ts'
import { SONGS } from '../../domain/songs/songs.ts'
import { toNotationDuration } from './duration-code.ts'

describe('toNotationDuration', () => {
  it('maps plain note values', () => {
    expect(toNotationDuration(createFraction(1, 1))).toEqual({ code: 'w', dots: 0 })
    expect(toNotationDuration(createFraction(1, 2))).toEqual({ code: 'h', dots: 0 })
    expect(toNotationDuration(createFraction(1, 4))).toEqual({ code: 'q', dots: 0 })
    expect(toNotationDuration(createFraction(1, 8))).toEqual({ code: '8', dots: 0 })
    expect(toNotationDuration(createFraction(1, 16))).toEqual({ code: '16', dots: 0 })
  })

  it('maps dotted values', () => {
    expect(toNotationDuration(createFraction(3, 8))).toEqual({ code: 'q', dots: 1 })
    expect(toNotationDuration(createFraction(3, 16))).toEqual({ code: '8', dots: 1 })
    expect(toNotationDuration(createFraction(3, 4))).toEqual({ code: 'h', dots: 1 })
    expect(toNotationDuration(createFraction(7, 16))).toEqual({ code: 'q', dots: 2 })
  })

  it('scales tuplet members back to their written value', () => {
    expect(toNotationDuration(createFraction(1, 12), { actual: 3, normal: 2 })).toEqual({ code: '8', dots: 0 })
    expect(toNotationDuration(createFraction(1, 5), { actual: 5, normal: 4 })).toEqual({ code: 'q', dots: 0 })
    expect(toNotationDuration(createFraction(1, 3), { actual: 3, normal: 2 })).toEqual({ code: 'h', dots: 0 })
  })

  it('returns null for values that need a tie to write', () => {
    expect(toNotationDuration(createFraction(5, 16))).toBeNull()
  })
})

describe('polyrhythm notation', () => {
  it('can write every division the custom ratio allows', async () => {
    const { createPolyrhythmPattern, MAXIMUM_POLYRHYTHM_DIVISIONS } = await import('../../domain/rhythm/polyrhythm.ts')
    for (let divisions = 1; divisions <= MAXIMUM_POLYRHYTHM_DIVISIONS; divisions++) {
      const [track] = createPolyrhythmPattern(divisions, 1).tracks
      for (const event of track.events) {
        expect(toNotationDuration(event.duration, event.notation.tuplet), `${divisions}`).not.toBeNull()
      }
    }
  })

  it('writes every song note as a plain or dotted note value', () => {
    for (const song of SONGS) {
      for (const event of songUnits(song).flatMap((unit) => unit.tracks[0].events)) {
        expect(toNotationDuration(event.duration), `${song.id} ${event.id}`).not.toBeNull()
      }
    }
  })
})
