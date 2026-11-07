export type StageClear = {
  clearedAt: string
  bestBpm: number
}

type ProgressBook = Record<string, StageClear>

const STORAGE_KEY = 'rhythm-lab.stage-progress.v1'

export function loadStageProgress(): ProgressBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProgressBook) : {}
  } catch {
    return {}
  }
}

export function markStageCleared(stageId: string, bpm: number): ProgressBook {
  const book = loadStageProgress()
  const previous = book[stageId]
  book[stageId] = {
    clearedAt: previous?.clearedAt ?? new Date().toISOString(),
    bestBpm: Math.max(previous?.bestBpm ?? 0, bpm),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
  } catch {
    // 저장이 막힌 환경에서는 이번 세션에만 남는다.
  }
  return book
}
