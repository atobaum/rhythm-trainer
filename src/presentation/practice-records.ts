import type { PracticeMode } from '../application/practice-types.ts'

export type PatternRecord = {
  bestStars: number
  bestCleanBpm: number | null
  attempts: number
}

export type RecordUpdate = {
  record: PatternRecord
  newBestStars: boolean
  newBestBpm: boolean
}

const STORAGE_KEY = 'rhythm-lab.records.v1'
const CLEAN_STARS = 3

type RecordBook = Record<string, PatternRecord>

const recordKey = (patternId: string, mode: PracticeMode) => `${patternId}:${mode}`

function loadBook(): RecordBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecordBook) : {}
  } catch {
    return {}
  }
}

export function loadRecord(patternId: string, mode: PracticeMode): PatternRecord | null {
  return loadBook()[recordKey(patternId, mode)] ?? null
}

export function saveAttempt(patternId: string, mode: PracticeMode, stars: number, bpm: number): RecordUpdate {
  const book = loadBook()
  const key = recordKey(patternId, mode)
  const previous = book[key] ?? { bestStars: 0, bestCleanBpm: null, attempts: 0 }
  const clean = stars >= CLEAN_STARS
  const newBestStars = stars > previous.bestStars
  const newBestBpm = clean && (previous.bestCleanBpm === null || bpm > previous.bestCleanBpm)
  const record: PatternRecord = {
    bestStars: Math.max(previous.bestStars, stars),
    bestCleanBpm: newBestBpm ? bpm : previous.bestCleanBpm,
    attempts: previous.attempts + 1,
  }
  book[key] = record
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
  } catch {
    // 저장이 막힌 환경에서는 기록을 남기지 않는다.
  }
  return { record, newBestStars, newBestBpm }
}
