import { describe, expect, it } from 'vitest'
import { buildReplaySounds } from './replay.ts'

describe('buildReplaySounds', () => {
  const base = { performMs: 4000, beatMs: 1000, beatsPerBar: 4 }

  it('counts in one bar, keeps the click going and plays my taps where I played them', () => {
    const sounds = buildReplaySounds({ ...base, hitTimesMs: [0, 1030, 1980] })
    expect(sounds.filter((sound) => sound.kind === 'tap').map((sound) => sound.timeMs)).toEqual([4000, 5030, 5980])
    expect(sounds.filter((sound) => sound.kind !== 'tap').map((sound) => sound.timeMs)).toEqual([
      0, 1000, 2000, 3000, 4000, 5000, 6000, 7000,
    ])
    expect(sounds[0].kind).toBe('accent')
  })

  it('plays the answer as notes', () => {
    const sounds = buildReplaySounds({ ...base, hitTimesMs: [0, 1000], kind: 'note' })
    expect(sounds.filter((sound) => sound.kind === 'note').map((sound) => sound.timeMs)).toEqual([4000, 5000])
  })

  it('drops taps far outside the performance', () => {
    const sounds = buildReplaySounds({ ...base, hitTimesMs: [-3000, 9000] })
    expect(sounds.some((sound) => sound.kind === 'tap')).toBe(false)
  })
})
