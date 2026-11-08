import { describe, expect, it } from 'vitest'
import { INITIAL_AUTO_ADJUST, nextAutoAdjust } from './auto-adjust.ts'
import type { AutoAdjustOptions, AutoAdjustState, AutoAdjustValues } from './auto-adjust.ts'
import type { BarOutcome } from './bar-flow.ts'

const both: AutoAdjustOptions = { tempoRamp: true, guideFade: true, guideCeiling: 'every-beat' }

function run(options: AutoAdjustOptions, values: AutoAdjustValues, outcomes: BarOutcome[], state: AutoAdjustState = INITIAL_AUTO_ADJUST) {
  const changes: (AutoAdjustValues | null)[] = []
  let current = values
  for (const outcome of outcomes) {
    const step = nextAutoAdjust(options, state, current, outcome)
    state = step.state
    changes.push(step.change)
    current = step.change ?? current
  }
  return { state, changes, current }
}

describe('nextAutoAdjust', () => {
  it('changes nothing when both options are off', () => {
    const result = run({ tempoRamp: false, guideFade: false, guideCeiling: 'every-beat' }, { bpm: 80, guide: 'every-beat' }, ['clean', 'clean', 'retry', 'clean', 'clean'])
    expect(result.changes.every((change) => change === null)).toBe(true)
  })

  it('raises tempo by 5 after two clean bars in a row and counts again from zero', () => {
    const options: AutoAdjustOptions = { tempoRamp: true, guideFade: false, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'every-beat' }, ['clean', 'clean', 'clean', 'clean'])
    expect(result.changes).toEqual([null, { bpm: 85, guide: 'every-beat' }, null, { bpm: 90, guide: 'every-beat' }])
    expect(result.state.tempoRaised).toBe(true)
  })

  it('needs consecutive clean bars', () => {
    const options: AutoAdjustOptions = { tempoRamp: true, guideFade: false, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'every-beat' }, ['clean', 'retry', 'clean', 'skip', 'clean'])
    expect(result.changes.every((change) => change === null)).toBe(true)
  })

  it('never lowers tempo on failure', () => {
    const options: AutoAdjustOptions = { tempoRamp: true, guideFade: false, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'every-beat' }, ['clean', 'clean', 'retry', 'retry'])
    expect(result.current.bpm).toBe(85)
  })

  it('stops at 200 BPM', () => {
    const options: AutoAdjustOptions = { tempoRamp: true, guideFade: false, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 195, guide: 'every-beat' }, ['clean', 'clean', 'clean', 'clean'])
    expect(result.changes).toEqual([null, { bpm: 200, guide: 'every-beat' }, null, null])
  })

  it('fades the guide one step at a time down to none', () => {
    const options: AutoAdjustOptions = { tempoRamp: false, guideFade: true, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'every-beat' }, ['clean', 'clean', 'clean', 'clean', 'clean', 'clean', 'clean', 'clean'])
    expect(result.changes.map((change) => change?.guide ?? null)).toEqual([null, 'first-beat', null, 'gap', null, 'none', null, null])
  })

  it('brings the guide back one step on failure but not above the ceiling', () => {
    const options: AutoAdjustOptions = { tempoRamp: false, guideFade: true, guideCeiling: 'first-beat' }
    const result = run(options, { bpm: 80, guide: 'first-beat' }, ['clean', 'clean', 'retry', 'retry'])
    expect(result.changes.map((change) => change?.guide ?? null)).toEqual([null, 'gap', 'first-beat', null])
  })

  it('restarts the clean count after a failure', () => {
    const options: AutoAdjustOptions = { tempoRamp: false, guideFade: true, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'first-beat' }, ['clean', 'retry', 'clean'])
    expect(result.changes).toEqual([null, { bpm: 80, guide: 'every-beat' }, null])
    expect(result.state.cleanStreak).toBe(1)
  })

  it('applies tempo and guide together on the same boundary', () => {
    const result = run(both, { bpm: 80, guide: 'every-beat' }, ['clean', 'clean'])
    expect(result.changes[1]).toEqual({ bpm: 85, guide: 'first-beat' })
  })

  it('keeps the guide change when tempo is already at maximum', () => {
    const result = run(both, { bpm: 200, guide: 'every-beat' }, ['clean', 'clean'])
    expect(result.changes[1]).toEqual({ bpm: 200, guide: 'first-beat' })
    expect(result.state.tempoRaised).toBe(false)
  })

  it('continues the count carried from a previous session', () => {
    const options: AutoAdjustOptions = { tempoRamp: true, guideFade: false, guideCeiling: 'every-beat' }
    const result = run(options, { bpm: 80, guide: 'every-beat' }, ['clean'], { cleanStreak: 1, tempoRaised: false })
    expect(result.changes).toEqual([{ bpm: 85, guide: 'every-beat' }])
  })
})
