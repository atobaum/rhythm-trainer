import { describe, expect, it } from 'vitest'
import { averageAttempts, createBarFlow, recordBar, stageClearedBy, stageSkillScore, tempoAfterStage } from './bar-flow.ts'
import type { BarOutcome } from './bar-flow.ts'

const play = (barCount: number, outcomes: BarOutcome[]) => outcomes.reduce(recordBar, createBarFlow(barCount))

describe('bar flow', () => {
  it('moves on after a clean first try and needs two clean in a row after a miss', () => {
    expect(play(3, ['clean']).index).toBe(1)
    const flow = play(3, ['retry', 'clean'])
    expect(flow.index).toBe(0)
    expect(play(3, ['retry', 'clean', 'retry', 'clean']).index).toBe(0)
    const passed = play(3, ['retry', 'retry', 'clean', 'clean', 'clean'])
    expect(passed.index).toBe(2)
    expect(passed.attempts).toEqual([4, 1, 0])
  })

  it('finishes after the last bar and clears the stage without skips', () => {
    const flow = play(2, ['clean', 'retry', 'clean', 'clean'])
    expect(flow.finished).toBe(true)
    expect(stageClearedBy(flow)).toBe(true)
    expect(averageAttempts(flow)).toBe(2)
    expect(recordBar(flow, 'clean')).toBe(flow)
  })

  it('does not clear a stage with a skipped bar', () => {
    const flow = play(2, ['retry', 'skip', 'clean'])
    expect(flow.finished).toBe(true)
    expect(flow.skipped).toEqual([true, false])
    expect(stageClearedBy(flow)).toBe(false)
    expect(stageSkillScore(flow)).toBe(0)
  })

  it('scores and changes tempo by average attempts', () => {
    expect(stageSkillScore(play(2, ['clean', 'clean']))).toBe(1)
    expect(stageSkillScore(play(2, ['retry', 'clean', 'clean', 'clean']))).toBe(0.6)
    expect(tempoAfterStage(80, play(2, ['clean', 'clean'])).change).toBe(5)
    expect(tempoAfterStage(80, play(2, ['retry', 'clean', 'clean', 'clean'])).change).toBe(0)
    expect(tempoAfterStage(80, play(1, ['retry', 'retry', 'clean', 'clean'])).change).toBe(-5)
    expect(tempoAfterStage(80, play(2, ['skip', 'clean'])).change).toBe(-5)
  })

  it('moves on after every outcome in a continuous flow and finishes once', () => {
    const flow = ['retry', 'clean', 'retry'].reduce((current, outcome) => recordBar(current, outcome as BarOutcome), createBarFlow(3, true))
    expect(flow.finished).toBe(true)
    expect(flow.attempts).toEqual([1, 1, 1])
    expect(flow.skipped).toEqual([false, false, false])
    expect(recordBar(flow, 'retry')).toBe(flow)
    expect(recordBar(createBarFlow(3, true), 'retry').index).toBe(1)
  })
})
