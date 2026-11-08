import { addFractions, compareFractions, createFraction, multiplyFractions } from '../rhythm/fraction.ts'
import type { Fraction } from '../rhythm/fraction.ts'
import type { RhythmEvent, RhythmPattern } from '../rhythm/pattern.ts'
import type { Song } from './songs.ts'

export type SongNote = {
  pitch: string | null
  duration: Fraction
  tiedToNext: boolean
}

// onset 은 단위 처음부터의 위치, 붙임줄로 이은 음은 하나로 합친 길이다.
export type MelodyNote = {
  onset: Fraction
  duration: Fraction
  frequency: number
}

export const SONG_BARS_PER_UNIT = 2

const NOTE_TOKEN = /^(R|[A-G](?:#|b)?\d)\/(1|2|4|8|16)(\.?)(~?)$/
const PITCH_NAME = /^([A-G])(#|b)?(\d)$/
const SEMITONES_FROM_C: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const A4_MIDI_NUMBER = 69
const A4_FREQUENCY = 440

export function pitchFrequency(pitch: string): number | null {
  const match = PITCH_NAME.exec(pitch)
  if (!match) {
    return null
  }
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  const midiNumber = (Number(match[3]) + 1) * 12 + SEMITONES_FROM_C[match[1]] + accidental
  return A4_FREQUENCY * 2 ** ((midiNumber - A4_MIDI_NUMBER) / 12)
}

function parseNote(token: string, where: string): SongNote {
  const match = NOTE_TOKEN.exec(token)
  if (!match) {
    throw new Error(`${where}: "${token}" 는 음 표기가 아닙니다`)
  }
  const base = createFraction(1, Number(match[2]))
  return {
    pitch: match[1] === 'R' ? null : match[1],
    duration: match[3] === '.' ? multiplyFractions(base, createFraction(3, 2)) : base,
    tiedToNext: match[4] === '~',
  }
}

export function songBars(song: Song): SongNote[][] {
  return song.score
    .split('|')
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0)
    .map((bar, index) => bar.split(/\s+/).map((token) => parseNote(token, `${song.title} ${index + 1}마디`)))
}

export function songBarCount(song: Song): number {
  return songBars(song).length
}

function barLengthOf(song: Song): Fraction {
  return createFraction(song.timeSignature.numerator, song.timeSignature.denominator)
}

function noteIdsBefore(bars: SongNote[][], barIndex: number): number {
  return bars.slice(0, barIndex).reduce((count, bar) => count + bar.length, 0)
}

// 이벤트 id 는 곡 전체에서 겹치지 않게 매겨 곡 전체 결과에서 음표별 치우침을 모을 수 있게 한다.
export function songPattern(song: Song, firstBar = 0, barCount = songBarCount(song)): RhythmPattern {
  const bars = songBars(song)
  const chosen = bars.slice(firstBar, firstBar + barCount)
  let noteNumber = noteIdsBefore(bars, firstBar)
  let onset = createFraction(0, 1)
  let tieGroup: string | null = null
  const events: RhythmEvent[] = []
  chosen.flat().forEach((note, index, notes) => {
    noteNumber++
    const continuesTie = tieGroup !== null
    if (note.tiedToNext && tieGroup === null) {
      tieGroup = `t${noteNumber}`
    }
    if (index === notes.length - 1 && note.tiedToNext) {
      throw new Error(`${song.title}: 붙임줄이 ${SONG_BARS_PER_UNIT}마디 단위 경계를 넘습니다`)
    }
    const inTie = note.tiedToNext || continuesTie
    events.push({
      id: `n${noteNumber}`,
      onset,
      duration: note.duration,
      kind: note.pitch === null ? 'rest' : 'note',
      notation: { dots: 0, ...(inTie && tieGroup !== null ? { tieGroupId: tieGroup } : {}) },
    })
    if (!note.tiedToNext) {
      tieGroup = null
    }
    onset = addFractions(onset, note.duration)
  })
  return {
    id: barCount === bars.length ? song.id : `${song.id}-bar${firstBar + 1}`,
    title: barCount === bars.length ? song.title : `${song.title} ${firstBar + 1}–${firstBar + barCount}마디`,
    timeSignature: song.timeSignature,
    bars: barCount,
    tracks: [{ id: 'main', role: 'single', instrument: 'tap', events }],
    tags: ['song'],
    difficulty: 1,
  }
}

export function songUnits(song: Song): RhythmPattern[] {
  const unitCount = Math.ceil(songBarCount(song) / SONG_BARS_PER_UNIT)
  return Array.from({ length: unitCount }, (_, unit) => songPattern(song, unit * SONG_BARS_PER_UNIT, SONG_BARS_PER_UNIT))
}

export function songMelody(song: Song): MelodyNote[][] {
  const bars = songBars(song)
  const units: MelodyNote[][] = []
  for (let first = 0; first < bars.length; first += SONG_BARS_PER_UNIT) {
    const melody: MelodyNote[] = []
    let onset = createFraction(0, 1)
    let held: MelodyNote | null = null
    for (const note of bars.slice(first, first + SONG_BARS_PER_UNIT).flat()) {
      if (held !== null) {
        held.duration = addFractions(held.duration, note.duration)
      } else if (note.pitch !== null) {
        const frequency = pitchFrequency(note.pitch)
        if (frequency === null) {
          throw new Error(`${song.title}: 음높이 ${note.pitch} 를 읽을 수 없습니다`)
        }
        held = { onset, duration: note.duration, frequency }
        melody.push(held)
      }
      if (!note.tiedToNext) {
        held = null
      }
      onset = addFractions(onset, note.duration)
    }
    units.push(melody)
  }
  return units
}

export function barLengthsMatch(song: Song): boolean {
  const barLength = barLengthOf(song)
  return songBars(song).every(
    (bar) => compareFractions(bar.reduce((sum, note) => addFractions(sum, note.duration), createFraction(0, 1)), barLength) === 0,
  )
}
