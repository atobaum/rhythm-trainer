import { generateExpectedEvents } from '../rhythm/event-generator.ts'
import { formatFraction } from '../rhythm/fraction.ts'
import { arrangeCells, patternFromCells, seededRandom } from '../rhythm/generator.ts'
import type { Cell, GenerationSpec } from '../rhythm/generator.ts'
import type { RhythmPattern } from '../rhythm/pattern.ts'

export type ChoiceQuestion = {
  options: RhythmPattern[]
  answerIndex: number
}

export type ComposeQuestion = {
  answer: RhythmPattern
  answerCells: Cell[]
  palette: Cell[]
  totalBeats: number
}

const OPTION_COUNT = 4
const MAXIMUM_ATTEMPTS = 80
const SIGNATURE_BPM = 60

// 패턴 음은 짧은 타악기 소리라서 4분음표와 "8분음표 + 8분쉼표" 는 들어서 구별되지 않는다. 그래서 소리가 나는 시점만 비교한다.
export function rhythmSignature(pattern: RhythmPattern): string {
  return generateExpectedEvents(pattern, { bpm: SIGNATURE_BPM })
    .map((event) => `${event.trackId}@${formatFraction(event.onset)}`)
    .join(' ')
}

export function sameRhythm(left: RhythmPattern, right: RhythmPattern): boolean {
  return rhythmSignature(left) === rhythmSignature(right)
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

function optionPattern(spec: GenerationSpec, cells: Cell[], label: string): RhythmPattern {
  return patternFromCells(`${spec.id}-dictation-${label}`, spec.title, cells, spec)
}

// 같은 단계 음형으로 만든 오답이 모자라면 앞 단계들의 사양으로 채운다.
export function makeChoiceQuestion(specs: GenerationSpec[], seed: number): ChoiceQuestion {
  const random = seededRandom(seed)
  const [mainSpec] = specs
  const answer = optionPattern(mainSpec, arrangeCells(mainSpec, Math.floor(random() * 1e9)), 'answer')
  const seen = new Set([rhythmSignature(answer)])
  const distractors: RhythmPattern[] = []
  for (const spec of specs) {
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS && distractors.length < OPTION_COUNT - 1; attempt++) {
      const sameShape = { ...spec, beatsPerBar: mainSpec.beatsPerBar, bars: mainSpec.bars }
      const candidate = optionPattern(sameShape, arrangeCells(sameShape, Math.floor(random() * 1e9)), `d${distractors.length}`)
      const signature = rhythmSignature(candidate)
      if (!seen.has(signature)) {
        seen.add(signature)
        distractors.push(candidate)
      }
    }
  }
  if (distractors.length < OPTION_COUNT - 1) {
    throw new Error(`서로 다른 선택지를 만들지 못했습니다: ${mainSpec.id}`)
  }
  const options = shuffle([answer, ...distractors], random).map((pattern, index) => ({ ...pattern, id: `${pattern.id}-${index}` }))
  return { options, answerIndex: options.findIndex((pattern) => pattern.id.startsWith(answer.id)) }
}

function uniqueCells(cells: Cell[]): Cell[] {
  const byKey = new Map<string, Cell>()
  for (const cell of cells) {
    byKey.set(JSON.stringify(cell), cell)
  }
  return [...byKey.values()].sort((left, right) => left.beats - right.beats)
}

export function makeComposeQuestion(spec: GenerationSpec, seed: number): ComposeQuestion {
  const answerCells = arrangeCells(spec, seed)
  return {
    answer: patternFromCells(`${spec.id}-compose-${seed}`, spec.title, answerCells, spec),
    answerCells,
    palette: uniqueCells([...spec.fillers, ...spec.features]).filter((cell) => cell.beats <= spec.beatsPerBar),
    totalBeats: spec.beatsPerBar * spec.bars,
  }
}

export function cellsBeats(cells: Cell[]): number {
  return cells.reduce((sum, cell) => sum + cell.beats, 0)
}

function onsetsByBeat(cells: Cell[]): string[][] {
  const beats: string[][] = Array.from({ length: cellsBeats(cells) }, () => [])
  let beat = 0
  for (const cell of cells) {
    const pattern = patternFromCells('cell', '', [cell], { beatsPerBar: cell.beats, bars: 1 })
    for (const event of generateExpectedEvents(pattern, { bpm: SIGNATURE_BPM })) {
      const beatsFromCellStart = (event.onset.numerator * 4) / event.onset.denominator
      const beatInCell = Math.floor(beatsFromCellStart + 1e-9)
      beats[beat + beatInCell].push((beatsFromCellStart - beatInCell).toFixed(4))
    }
    beat += cell.beats
  }
  return beats
}

// 박마다 소리가 나는 시점이 같은지 본다. 틀린 박 번호(0부터)를 돌려준다.
export function wrongBeats(answerCells: Cell[], composedCells: Cell[]): number[] {
  const answer = onsetsByBeat(answerCells)
  const composed = onsetsByBeat(composedCells)
  const wrong: number[] = []
  answer.forEach((onsets, beat) => {
    if (JSON.stringify(onsets) !== JSON.stringify(composed[beat] ?? [])) {
      wrong.push(beat)
    }
  })
  return wrong
}
