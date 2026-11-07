import { createFraction } from './fraction.ts'
import type { RhythmEvent, RhythmPattern } from './pattern.ts'

export type StrumPatternSpec = {
  id: string
  title: string
  slotsPerBeat: 2 | 4
  // 슬롯마다 한 글자. x 침, X 강세로 침, - 헛스트로크(손만 지나감). 방향은 슬롯 위치로 정해진다(앞 슬롯 다운, 뒤 슬롯 업).
  strokes: string
  tags: string[]
}

export const STRUM_PATTERN_SPECS: StrumPatternSpec[] = [
  { id: 'strum-quarter-down', title: '4분 다운', slotsPerBeat: 2, strokes: 'x-x-x-x-', tags: ['quarter-note'] },
  { id: 'strum-eighth', title: '8비트 다운업', slotsPerBeat: 2, strokes: 'XxxxXxxx', tags: ['eighth-note'] },
  { id: 'strum-pop', title: '팝 (↓ ↓ ↓↑↓↑)', slotsPerBeat: 2, strokes: 'x-x-xxxx', tags: ['eighth-note'] },
  { id: 'strum-folk', title: '포크 (↓ ↓↑ ↑↓↑)', slotsPerBeat: 2, strokes: 'x-xx-xxx', tags: ['eighth-note', 'syncopation'] },
  { id: 'strum-backbeat', title: '백비트 강세', slotsPerBeat: 2, strokes: 'x-Xx-xXx', tags: ['eighth-note', 'syncopation'] },
  { id: 'strum-syncopated', title: '당김 (↓ ↓↑ ↑ ↑)', slotsPerBeat: 2, strokes: 'x-xx-x-x', tags: ['eighth-note', 'syncopation'] },
  { id: 'strum-reggae', title: '레게 업스트로크', slotsPerBeat: 2, strokes: '-x-x-x-x', tags: ['eighth-note', 'syncopation'] },
  { id: 'strum-sixteenth', title: '16비트 다운업', slotsPerBeat: 4, strokes: 'Xxxxxxxxxxxxxxxx', tags: ['sixteenth-note'] },
  { id: 'strum-funk', title: '16비트 펑크', slotsPerBeat: 4, strokes: 'x-xx-xx-x-xx-xx-', tags: ['sixteenth-note', 'syncopation'] },
  { id: 'strum-sixteenth-rock', title: '16비트 록', slotsPerBeat: 4, strokes: 'x-x-x-xxx-x-x-xx', tags: ['sixteenth-note'] },
]

export function strumPattern(spec: StrumPatternSpec): RhythmPattern {
  const slotDuration = createFraction(1, 4 * spec.slotsPerBeat)
  const events: RhythmEvent[] = [...spec.strokes].map((symbol, index) => ({
    id: `s${index + 1}`,
    onset: createFraction(index, 4 * spec.slotsPerBeat),
    duration: slotDuration,
    kind: 'note',
    notation: { dots: 0 },
    ...(symbol === 'X' ? { articulation: { accent: true } } : {}),
    strum: { direction: index % 2 === 0 ? 'down' : 'up', motion: symbol === '-' ? 'ghost' : 'sound' },
  }))
  const beats = spec.strokes.length / spec.slotsPerBeat
  return {
    id: spec.id,
    title: spec.title,
    timeSignature: { numerator: beats, denominator: 4 },
    bars: 1,
    tracks: [{ id: 'main', role: 'single', instrument: 'guitar', events }],
    tags: ['strumming', ...spec.tags],
    difficulty: spec.slotsPerBeat,
  }
}

export const STRUM_PATTERNS: RhythmPattern[] = STRUM_PATTERN_SPECS.map(strumPattern)
