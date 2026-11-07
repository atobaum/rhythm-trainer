import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from '../rhythm/event-generator.ts'
import { createFraction, fractionToNumber } from '../rhythm/fraction.ts'
import { splitIntoBars, validatePattern } from '../rhythm/pattern.ts'
import { SONG_BARS_PER_UNIT, barLengthsMatch, pitchFrequency, songBarCount, songBars, songMelody, songPattern, songUnits } from './song-pattern.ts'
import { SONGS } from './songs.ts'
import type { Song } from './songs.ts'

const testSong = (score: string): Song => ({
  id: 'song-test',
  title: '시험 곡',
  source: '시험',
  key: 'C장조',
  timeSignature: { numerator: 4, denominator: 4 },
  defaultBpm: 60,
  score,
})

describe('song data', () => {
  it.each(SONGS.map((song) => [song.title, song] as const))('%s 는 마디 길이가 박자와 맞고 두 마디 단위로 나뉜다', (_, song) => {
    expect(barLengthsMatch(song)).toBe(true)
    expect(songBarCount(song) % SONG_BARS_PER_UNIT).toBe(0)
    expect(songBars(song)[0][0].pitch).not.toBeNull()
    for (const note of songBars(song).flat()) {
      if (note.pitch !== null) {
        expect(pitchFrequency(note.pitch)).not.toBeNull()
      }
    }
  })

  it.each(SONGS.map((song) => [song.title, song] as const))('%s 는 규칙을 지키는 단위 패턴과 멜로디로 바뀐다', (_, song) => {
    const units = songUnits(song)
    const melody = songMelody(song)
    expect(units).toHaveLength(songBarCount(song) / SONG_BARS_PER_UNIT)
    expect(melody).toHaveLength(units.length)
    units.forEach((unit, index) => {
      expect(validatePattern(unit)).toEqual([])
      expect(splitIntoBars(unit)).not.toBeNull()
      const onsets = generateExpectedEvents(unit, { bpm: 60 }).map((event) => fractionToNumber(event.onset))
      expect(melody[index].map((note) => fractionToNumber(note.onset))).toEqual(onsets)
    })
    expect(validatePattern(songPattern(song))).toEqual([])
  })

  it('has unique song ids', () => {
    expect(new Set(SONGS.map((song) => song.id)).size).toBe(SONGS.length)
  })
})

describe('song conversion', () => {
  it('reads pitch names as equal-tempered frequencies', () => {
    expect(pitchFrequency('A4')).toBe(440)
    expect(pitchFrequency('C4')).toBeCloseTo(261.63, 2)
    expect(pitchFrequency('F#4')).toBeCloseTo(369.99, 2)
    expect(pitchFrequency('Bb3')).toBeCloseTo(233.08, 2)
    expect(pitchFrequency('H4')).toBeNull()
  })

  it('reads dotted notes, rests and ties', () => {
    const song = testSong('C4/4. D4/8 R/4 E4/4~ | E4/4 F4/2. | G4/1 | R/1')
    const [first] = songUnits(song)
    const events = first.tracks[0].events
    expect(events.map((event) => event.kind)).toEqual(['note', 'note', 'rest', 'note', 'note', 'note'])
    expect(events[0].duration).toEqual(createFraction(3, 8))
    expect(events[3].notation.tieGroupId).toBe('t4')
    expect(events[4].notation.tieGroupId).toBe('t4')
    expect(events[5].notation.tieGroupId).toBeUndefined()
    expect(generateExpectedEvents(first, { bpm: 60 })).toHaveLength(4)
    expect(songMelody(song)[0].map((note) => [fractionToNumber(note.onset), fractionToNumber(note.duration)])).toEqual([
      [0, 0.375],
      [0.375, 0.125],
      [0.75, 0.5],
      [1.25, 0.75],
    ])
    expect(songMelody(song)[1]).toHaveLength(1)
  })

  it('numbers events across the whole song', () => {
    const song = testSong('C4/2 C4/2 | D4/1 | E4/1 | F4/1')
    const units = songUnits(song)
    expect(units[1].tracks[0].events.map((event) => event.id)).toEqual(['n4', 'n5'])
    expect(units[1].title).toBe('시험 곡 3–4마디')
    expect(songPattern(song).bars).toBe(4)
  })

  it('rejects ties across a unit boundary and unknown tokens', () => {
    expect(() => songUnits(testSong('C4/1 | C4/1~ | C4/1 | C4/1'))).toThrow()
    expect(() => songBars(testSong('C4/3'))).toThrow()
  })
})
