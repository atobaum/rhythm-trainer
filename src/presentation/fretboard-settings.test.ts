import { describe, expect, it } from 'vitest'
import { DEFAULT_FRETBOARD_SETTINGS, normalizeFretboardSettings } from './fretboard-settings.ts'

describe('지판 설정 읽기', () => {
  it('저장된 값이 없으면 기본값이다', () => {
    expect(normalizeFretboardSettings({})).toEqual(DEFAULT_FRETBOARD_SETTINGS)
  })

  it('범위를 벗어난 값은 고친다', () => {
    const settings = normalizeFretboardSettings({ strings: [7, 2, 2, 0, 5], fromFret: -3, toFret: 40, questionCount: 15 as never })
    expect(settings.strings).toEqual([2, 5])
    expect(settings.fromFret).toBe(0)
    expect(settings.toFret).toBe(15)
    expect(settings.questionCount).toBe(20)
  })

  it('시작 프렛이 끝보다 크면 기본 범위로 돌린다', () => {
    const settings = normalizeFretboardSettings({ fromFret: 9, toFret: 3 })
    expect([settings.fromFret, settings.toFret]).toEqual([0, 12])
  })
})
