import { describe, expect, it } from 'vitest'
import { tapSoundKind, type TapZone } from './tap-zones.ts'

function zone(overrides: Partial<TapZone>): TapZone {
  return { id: 'single', label: '', hint: '', trackId: 't1', keys: [], ...overrides }
}

describe('tapSoundKind', () => {
  it('한 영역은 탭 소리', () => {
    expect(tapSoundKind(zone({}))).toBe('tap')
  })

  it('스트로크 영역은 방향별 스트로크 소리', () => {
    expect(tapSoundKind(zone({ id: 'down', direction: 'down' }))).toBe('strum-down')
    expect(tapSoundKind(zone({ id: 'up', direction: 'up' }))).toBe('strum-up')
  })

  it('양손 영역은 왼손 낮은, 오른손 높은 탭 소리', () => {
    expect(tapSoundKind(zone({ id: 'left' }))).toBe('tap-low')
    expect(tapSoundKind(zone({ id: 'right' }))).toBe('tap-high')
  })
})
