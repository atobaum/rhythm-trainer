import { cellsToEvents, note, rest, triplet } from './generator.ts'
import type { Cell } from './generator.ts'
import type { RhythmPattern } from './pattern.ts'

const beat = (...items: Cell['items']): Cell => ({ beats: 1, items })
const twoBeats = (...items: Cell['items']): Cell => ({ beats: 2, items })

const QUARTER = beat(note(1, 4))
const QUARTER_REST = beat(rest(1, 4))
const EIGHTHS = beat(note(1, 8), note(1, 8))
const OFFBEAT = beat(rest(1, 8), note(1, 8))
const SIXTEENTHS = beat(note(1, 16), note(1, 16), note(1, 16), note(1, 16))
const EIGHTH_TWO_SIXTEENTHS = beat(note(1, 8), note(1, 16), note(1, 16))
const TRIPLET = beat(triplet(1, 12), triplet(1, 12), triplet(1, 12))
const HALF = twoBeats(note(1, 2))
const SYNCOPATION = twoBeats(note(1, 8), note(1, 4), note(1, 8))
const DOTTED = twoBeats(note(3, 8), note(1, 8))

type TwoHandSpec = { id: string; title: string; left: Cell[]; right: Cell[] }

const repeat = (cells: Cell[], times: number) => Array.from({ length: times }, () => cells).flat()

// 한 손은 박을 지키고 다른 손이 리듬을 치는 것부터, 두 손이 모두 리듬을 치는 것까지 쉬운 순서로 둔다.
const SPECS: TwoHandSpec[] = [
  { id: 'two-hand-quarter-eighths', title: '왼손 4분 · 오른손 8분', left: repeat([QUARTER], 4), right: repeat([EIGHTHS], 4) },
  { id: 'two-hand-half-quarter', title: '왼손 2분 · 오른손 4분', left: repeat([HALF], 2), right: repeat([QUARTER], 4) },
  { id: 'two-hand-quarter-offbeat', title: '왼손 정박 · 오른손 뒷박', left: repeat([QUARTER], 4), right: repeat([OFFBEAT], 4) },
  { id: 'two-hand-rests', title: '왼손 4분 · 오른손 쉼표 섞기', left: repeat([QUARTER], 4), right: [EIGHTHS, QUARTER_REST, EIGHTHS, QUARTER] },
  { id: 'two-hand-syncopation', title: '왼손 4분 · 오른손 당김음', left: repeat([QUARTER], 4), right: [SYNCOPATION, SYNCOPATION] },
  { id: 'two-hand-rock-beat', title: '록 비트 (왼손 킥 · 오른손 8분)', left: [QUARTER, QUARTER_REST, EIGHTHS, QUARTER_REST], right: repeat([EIGHTHS], 4) },
  { id: 'two-hand-dotted', title: '왼손 점4분 · 오른손 8분', left: [DOTTED, DOTTED], right: repeat([EIGHTHS], 4) },
  { id: 'two-hand-sixteenths', title: '왼손 4분 · 오른손 16분 섞기', left: repeat([QUARTER], 4), right: [SIXTEENTHS, EIGHTHS, EIGHTH_TWO_SIXTEENTHS, QUARTER] },
  { id: 'two-hand-triplets', title: '왼손 4분 · 오른손 3연음', left: repeat([QUARTER], 4), right: [TRIPLET, TRIPLET, TRIPLET, QUARTER] },
  { id: 'two-hand-crossing', title: '두 손 엇갈리기', left: [EIGHTHS, OFFBEAT, QUARTER, OFFBEAT], right: [OFFBEAT, EIGHTHS, OFFBEAT, QUARTER] },
  { id: 'two-hand-funk', title: '펑크 (왼손 당김 · 오른손 16분)', left: [SYNCOPATION, OFFBEAT, QUARTER], right: repeat([SIXTEENTHS], 4) },
]

function track(role: 'left' | 'right', cells: Cell[]) {
  const events = cellsToEvents(cells).map((event) => ({
    ...event,
    id: `${role}-${event.id}`,
    notation: event.notation.tupletGroup ? { ...event.notation, tupletGroup: `${role}-${event.notation.tupletGroup}` } : event.notation,
  }))
  return { id: role, role, instrument: 'tap' as const, events }
}

export const TWO_HAND_PATTERNS: RhythmPattern[] = SPECS.map((spec, index) => ({
  id: spec.id,
  title: spec.title,
  timeSignature: { numerator: 4, denominator: 4 },
  bars: 1,
  tracks: [track('left', spec.left), track('right', spec.right)],
  tags: ['two-hand'],
  difficulty: index + 1,
}))

export function singleHand(pattern: RhythmPattern, role: 'left' | 'right'): RhythmPattern {
  const chosen = pattern.tracks.find((candidate) => candidate.role === role) ?? pattern.tracks[0]
  return {
    ...pattern,
    id: `${pattern.id}-${role}-only`,
    title: `${pattern.title} (${role === 'left' ? '왼손만' : '오른손만'})`,
    tracks: [{ ...chosen, role: 'single' }],
  }
}
