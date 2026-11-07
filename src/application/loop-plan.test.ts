import { describe, expect, it } from 'vitest'
import { parsePattern } from '../domain/rhythm/pattern.ts'
import { buildLoopPlan } from './loop-plan.ts'

const pattern = parsePattern({
  id: 'p',
  title: 'p',
  timeSignature: { numerator: 4, denominator: 4 },
  bars: 1,
  tags: [],
  difficulty: 1,
  tracks: [
    {
      id: 'main',
      role: 'single',
      instrument: 'tap',
      events: [
        { id: 'a', onset: '0', duration: '1/2', kind: 'note' },
        { id: 'b', onset: '1/2', duration: '1/2', kind: 'note' },
      ],
    },
  ],
})

describe('buildLoopPlan', () => {
  it('counts in once before reading and then repeats the bar', () => {
    const plan = buildLoopPlan(pattern, { mode: 'reading', bpm: 60, guide: 'every-beat' })
    expect(plan.performStartMs).toBe(4000)
    expect(plan.patternMs).toBe(4000)
    expect(plan.introSounds.map((sound) => sound.timeMs)).toEqual([0, 1000, 2000, 3000])
    expect(plan.soundsForRepetition(2).map((sound) => [sound.timeMs, sound.kind])).toEqual([
      [12000, 'accent'],
      [13000, 'beat'],
      [14000, 'beat'],
      [15000, 'beat'],
    ])
  })

  it('places expected events of any repetition', () => {
    const plan = buildLoopPlan(pattern, { mode: 'reading', bpm: 60, guide: 'every-beat' })
    expect(plan.expectedForRepetition(3).map((event) => [event.repetition, event.targetTimeMs])).toEqual([
      [3, 16000],
      [3, 18000],
    ])
  })

  it('listens once and starts right away when imitating', () => {
    const plan = buildLoopPlan(pattern, { mode: 'imitation', bpm: 60, guide: 'every-beat' })
    expect(plan.performStartMs).toBe(4000)
    expect(plan.introSounds.filter((sound) => sound.kind === 'note').map((sound) => sound.timeMs)).toEqual([0, 2000])
    expect(plan.phaseAt(1000)).toBe('preview')
    expect(plan.phaseAt(5000)).toBe('perform')
  })

  it('이어서 칠 때는 듣고 따라 치기도 미리 듣기 없이 카운트인 1마디', () => {
    const plan = buildLoopPlan(pattern, { mode: 'imitation', bpm: 60, guide: 'every-beat', skipPreview: true })
    expect(plan.performStartMs).toBe(4000)
    expect(plan.introSounds.filter((sound) => sound.kind === 'note')).toEqual([])
    expect(plan.phaseAt(1000)).toBe('count-in')
  })

  it('mutes every other bar in gap mode across repetitions', () => {
    const plan = buildLoopPlan(pattern, { mode: 'reading', bpm: 60, guide: 'gap' })
    expect(plan.soundsForRepetition(0)).toHaveLength(4)
    expect(plan.soundsForRepetition(1)).toHaveLength(0)
    expect(plan.isMutedRepetitionBar(1, 0)).toBe(true)
  })

  it('reports the count-in phase', () => {
    const plan = buildLoopPlan(pattern, { mode: 'reading', bpm: 60, guide: 'every-beat' })
    expect(plan.phaseAt(500)).toBe('count-in')
    expect(plan.phaseAt(-10)).toBe('ready')
  })
})
