import { emptyPositionRecords } from '../domain/fretboard/position-records.ts'
import type { PositionRecords, RecentAttempt } from '../domain/fretboard/position-records.ts'
import { readStored, writeStored } from './local-store.ts'

const STORAGE_KEY = 'rhythm-lab.fretboard-records.v1'

function isRecentAttempt(value: unknown): value is RecentAttempt {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const attempt = value as Partial<RecentAttempt>
  return typeof attempt.correct === 'boolean' && typeof attempt.responseMs === 'number' && Number.isFinite(attempt.responseMs)
}

function normalizeModeRecords(stored: unknown): Record<string, RecentAttempt[]> {
  if (typeof stored !== 'object' || stored === null) {
    return {}
  }
  const records: Record<string, RecentAttempt[]> = {}
  for (const [key, attempts] of Object.entries(stored)) {
    if (Array.isArray(attempts)) {
      const valid = attempts.filter(isRecentAttempt)
      if (valid.length > 0) {
        records[key] = valid
      }
    }
  }
  return records
}

export function normalizePositionRecords(stored: unknown): PositionRecords {
  const source = typeof stored === 'object' && stored !== null ? (stored as Partial<Record<keyof PositionRecords, unknown>>) : {}
  return {
    'name-the-note': normalizeModeRecords(source['name-the-note']),
    'find-the-position': normalizeModeRecords(source['find-the-position']),
  }
}

export function loadPositionRecords(): PositionRecords {
  return normalizePositionRecords(readStored<unknown>(STORAGE_KEY, null))
}

export function savePositionRecords(records: PositionRecords): void {
  writeStored(STORAGE_KEY, records)
}

export function clearPositionRecords(): PositionRecords {
  const empty = emptyPositionRecords()
  savePositionRecords(empty)
  return empty
}
