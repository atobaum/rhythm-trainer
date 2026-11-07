import { note, rest, triplet } from './generator.ts'
import type { Cell } from './generator.ts'

export type Figure = {
  id: string
  label: string
  cells: Cell[]
}

const cell = (beats: 1 | 2, ...items: Cell['items']): Cell => ({ beats, items })

// 배우는 순서대로 둔다. 단계는 이 순서로 하나씩 새 음형을 더하고, 앞에서 배운 음형을 채우기에 쓴다.
export const FIGURES: Figure[] = [
  { id: 'quarter', label: '4분음표', cells: [cell(1, note(1, 4))] },
  { id: 'quarter-rest', label: '4분쉼표', cells: [cell(1, rest(1, 4))] },
  { id: 'two-eighths', label: '8분음표 2개', cells: [cell(1, note(1, 8), note(1, 8))] },
  { id: 'eighth-rest-after', label: '8분음표와 8분쉼표', cells: [cell(1, note(1, 8), rest(1, 8))] },
  { id: 'offbeat-eighth', label: '뒷박 8분음표', cells: [cell(1, rest(1, 8), note(1, 8))] },
  { id: 'eighth-quarter-eighth', label: '당김음 (8분-4분-8분)', cells: [cell(2, note(1, 8), note(1, 4), note(1, 8))] },
  { id: 'dotted-quarter', label: '점4분음표와 8분음표', cells: [cell(2, note(3, 8), note(1, 8))] },
  { id: 'triplet', label: '3연음', cells: [cell(1, triplet(1, 12), triplet(1, 12), triplet(1, 12))] },
  { id: 'triplet-no-second', label: '두 번째 비트가 없는 3연음', cells: [cell(1, triplet(1, 6), triplet(1, 12))] },
  { id: 'triplet-no-third', label: '세 번째 비트가 없는 3연음', cells: [cell(1, triplet(1, 12), triplet(1, 6))] },
  {
    id: 'triplet-middle-rest',
    label: '가운데를 쉬는 3연음',
    cells: [cell(1, triplet(1, 12), { ...triplet(1, 12), rest: true }, triplet(1, 12))],
  },
  {
    id: 'triplet-first-rest',
    label: '첫 비트를 쉬는 3연음',
    cells: [cell(1, { ...triplet(1, 12), rest: true }, triplet(1, 12), triplet(1, 12))],
  },
  {
    id: 'triplet-only-second',
    label: '두 번 멈춘 3연음, 두 번째에 비트',
    cells: [cell(1, { ...triplet(1, 12), rest: true }, triplet(1, 12), { ...triplet(1, 12), rest: true })],
  },
  {
    id: 'triplet-only-third',
    label: '두 번 멈춘 3연음, 세 번째에 비트',
    cells: [cell(1, { ...triplet(1, 6), rest: true }, triplet(1, 12))],
  },
  { id: 'quarter-triplet', label: '4분음표 3연음', cells: [cell(2, triplet(1, 6), triplet(1, 6), triplet(1, 6))] },
  { id: 'four-sixteenths', label: '16분음표 4개', cells: [cell(1, note(1, 16), note(1, 16), note(1, 16), note(1, 16))] },
  { id: 'eighth-two-sixteenths', label: '8분음표 후 16분음표 2개', cells: [cell(1, note(1, 8), note(1, 16), note(1, 16))] },
  { id: 'two-sixteenths-eighth', label: '16분음표 2개 후 8분음표', cells: [cell(1, note(1, 16), note(1, 16), note(1, 8))] },
  { id: 'sixteenth-eighth-sixteenth', label: '16분-8분-16분', cells: [cell(1, note(1, 16), note(1, 8), note(1, 16))] },
  { id: 'dotted-eighth-sixteenth', label: '점8분음표 후 16분음표', cells: [cell(1, note(3, 16), note(1, 16))] },
  { id: 'sixteenth-dotted-eighth', label: '16분음표 후 점8분음표', cells: [cell(1, note(1, 16), note(3, 16))] },
  { id: 'rest-three-sixteenths', label: '쉼표 후 16분음표 3개', cells: [cell(1, rest(1, 16), note(1, 16), note(1, 16), note(1, 16))] },
  { id: 'offbeat-two-sixteenths', label: '8분쉼표 후 16분음표 2개', cells: [cell(1, rest(1, 8), note(1, 16), note(1, 16))] },
  {
    id: 'tied-eighths',
    label: '박을 넘는 붙임줄',
    cells: [cell(2, note(1, 8), note(1, 8, { tieToNext: true }), note(1, 8), note(1, 8))],
  },
  {
    id: 'sixteenth-syncopation',
    label: '16분음표 당김음',
    cells: [cell(2, note(1, 16), note(1, 8), note(1, 16, { tieToNext: true }), note(1, 8), note(1, 8))],
  },
  {
    id: 'sixteenth-gaps',
    label: '띄엄띄엄 16분음표',
    cells: [cell(1, rest(1, 16), note(1, 16), rest(1, 16), note(1, 16)), cell(1, note(1, 16), rest(1, 16), note(1, 16), note(1, 16))],
  },
]

export function figureById(id: string): Figure {
  const figure = FIGURES.find((candidate) => candidate.id === id)
  if (!figure) {
    throw new Error(`알 수 없는 음형입니다: ${id}`)
  }
  return figure
}
