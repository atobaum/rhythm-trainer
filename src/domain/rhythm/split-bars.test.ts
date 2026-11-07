import { describe, expect, it } from 'vitest'
import { cellsToEvents, note, patternFromCells, triplet } from './generator.ts'
import { formatFraction } from './fraction.ts'
import { splitIntoBars } from './pattern.ts'

const shape = { beatsPerBar: 4, bars: 2 }
const quarter = { beats: 1 as const, items: [note(1, 4)] }
const tripletBeat = { beats: 1 as const, items: [triplet(1, 6), triplet(1, 12)] }

describe('splitIntoBars', () => {
  it('두 마디 패턴을 마디마다 0 에서 시작하는 한 마디 패턴으로 나눈다', () => {
    const pattern = patternFromCells('p', 'p', [quarter, quarter, quarter, quarter, tripletBeat, quarter, quarter, quarter], shape)
    const bars = splitIntoBars(pattern)
    expect(bars).not.toBeNull()
    expect(bars!.map((bar) => bar.bars)).toEqual([1, 1])
    expect(bars![0].tracks[0].events.map((event) => formatFraction(event.onset))).toEqual(['0', '1/4', '1/2', '3/4'])
    expect(bars![1].tracks[0].events.map((event) => formatFraction(event.onset))).toEqual(['0', '1/6', '1/4', '1/2', '3/4'])
    expect(bars![1].tracks[0].events[0].notation.tupletGroup).toBeDefined()
  })

  it('마디선을 넘는 이벤트가 있으면 나누지 않는다', () => {
    const pattern = patternFromCells('p', 'p', [quarter, quarter, quarter, quarter, quarter, quarter, quarter, quarter], shape)
    const events = cellsToEvents([quarter, quarter, quarter, { beats: 2, items: [note(1, 2)] }, quarter, quarter])
    expect(splitIntoBars({ ...pattern, tracks: [{ ...pattern.tracks[0], events }] })).toBeNull()
  })

  it('붙임줄이 마디선을 넘으면 나누지 않는다', () => {
    const tiedAcross = [quarter, quarter, quarter, { beats: 1 as const, items: [note(1, 4, { tieToNext: true })] }, quarter, quarter, quarter, quarter]
    expect(splitIntoBars(patternFromCells('p', 'p', tiedAcross, shape))).toBeNull()
  })
})
