import { describe, expect, it } from 'vitest'
import { normalizePositionRecords } from './fretboard-records.ts'

describe('지판 기록 읽기', () => {
  it('저장된 값이 없거나 모양이 틀리면 빈 기록이다', () => {
    expect(normalizePositionRecords(null)).toEqual({ 'name-the-note': {}, 'find-the-position': {} })
    expect(normalizePositionRecords('oops')).toEqual({ 'name-the-note': {}, 'find-the-position': {} })
  })

  it('모양이 틀린 항목만 버린다', () => {
    const records = normalizePositionRecords({
      'name-the-note': { '1:3': [{ correct: true, responseMs: 900 }, { correct: 'yes', responseMs: 1 }], '2:1': 'bad' },
      'find-the-position': { '6:9': [] },
    })
    expect(records).toEqual({ 'name-the-note': { '1:3': [{ correct: true, responseMs: 900 }] }, 'find-the-position': {} })
  })
})
