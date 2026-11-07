export type SkillEntry = {
  recentScores: number[]
  attempts: number
  lastPracticedAt: string
}

export type SkillBook = Record<string, SkillEntry>

const RECENT_SCORE_COUNT = 5
const QUICK_PASS_REPETITIONS = 3
const SLOW_PASS_SCORE = 0.6
const MILLISECONDS_PER_DAY = 86_400_000

export function outcomeScore(passed: boolean, repetitionsPlayed: number): number {
  if (!passed) {
    return 0
  }
  return repetitionsPlayed <= QUICK_PASS_REPETITIONS ? 1 : SLOW_PASS_SCORE
}

export function recordSkill(book: SkillBook, key: string, score: number, at: Date): SkillBook {
  const previous = book[key]
  return {
    ...book,
    [key]: {
      recentScores: [...(previous?.recentScores ?? []), score].slice(-RECENT_SCORE_COUNT),
      attempts: (previous?.attempts ?? 0) + 1,
      lastPracticedAt: at.toISOString(),
    },
  }
}

export function weakness(entry: SkillEntry | undefined): number {
  if (!entry || entry.recentScores.length === 0) {
    return 0
  }
  const mean = entry.recentScores.reduce((sum, score) => sum + score, 0) / entry.recentScores.length
  return 1 - mean
}

export function daysSincePractice(entry: SkillEntry | undefined, now: Date): number {
  if (!entry) {
    return Infinity
  }
  return Math.max(0, (now.getTime() - new Date(entry.lastPracticedAt).getTime()) / MILLISECONDS_PER_DAY)
}
