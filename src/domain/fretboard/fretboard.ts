export const STRING_NUMBERS = [1, 2, 3, 4, 5, 6] as const
export const MAX_FRET = 15
export const INLAY_FRETS = [3, 5, 7, 9, 15] as const
export const DOUBLE_INLAY_FRET = 12

// 줄 번호(1번줄이 가장 높은 줄)별 표준 튜닝 개방현 음. C 를 0 으로 둔 반음 수다.
const OPEN_STRING_PITCH_CLASSES: Record<number, number> = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 }

// 표준 튜닝 실제 음높이. 6번줄 개방현 E2 가 MIDI 40 이다.
const OPEN_STRING_MIDI_NUMBERS: Record<number, number> = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const A4_MIDI_NUMBER = 69
const A4_FREQUENCY = 440

export const NOTE_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'] as const

export type FretPosition = {
  stringNumber: number
  fret: number
}

export type FretRange = {
  strings: number[]
  fromFret: number
  toFret: number
}

export function pitchClassAt(position: FretPosition): number {
  return (OPEN_STRING_PITCH_CLASSES[position.stringNumber] + position.fret) % 12
}

export function frequencyAt(position: FretPosition): number {
  const midiNumber = OPEN_STRING_MIDI_NUMBERS[position.stringNumber] + position.fret
  return A4_FREQUENCY * 2 ** ((midiNumber - A4_MIDI_NUMBER) / 12)
}

export function noteName(pitchClass: number): string {
  return NOTE_NAMES[pitchClass]
}

export function openStringNoteName(stringNumber: number): string {
  return noteName(pitchClassAt({ stringNumber, fret: 0 }))
}

export function clampFret(fret: number): number {
  return Math.min(MAX_FRET, Math.max(0, Math.round(fret)))
}

export function isInRange(range: FretRange, position: FretPosition): boolean {
  return range.strings.includes(position.stringNumber) && position.fret >= range.fromFret && position.fret <= range.toFret
}

export function positionsInRange(range: FretRange): FretPosition[] {
  return STRING_NUMBERS.filter((stringNumber) => range.strings.includes(stringNumber)).flatMap((stringNumber) =>
    Array.from({ length: range.toFret - range.fromFret + 1 }, (_, offset) => ({ stringNumber, fret: range.fromFret + offset })),
  )
}

export function drawnFrets(range: FretRange, margin = 1): { fromFret: number; toFret: number } {
  return { fromFret: Math.max(0, range.fromFret - margin), toFret: Math.min(MAX_FRET, range.toFret + margin) }
}
