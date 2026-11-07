import { generateFromCells } from '../rhythm/generator.ts'
import type { RhythmPattern } from '../rhythm/pattern.ts'
import { daysSincePractice, weakness } from '../practice/skill.ts'
import type { SkillBook } from '../practice/skill.ts'
import { STAGES, currentStageIndex, skillKeyOf } from './stages.ts'
import type { Stage } from './stages.ts'

export type QuickItemKind = 'continue' | 'review' | 'new' | 'challenge' | 'easier'
export type QuickStrategy = 'auto' | 'review-first' | 'progress-first'

export type QuickItem = {
  kind: QuickItemKind
  stage: Stage
  pattern: RhythmPattern
  skillKey: string
}

export type QuickHistoryEntry = {
  stageId: string
  patternId: string
  skillKey: string
  score: number
}

export type CurationInput = {
  clearedStageIds: Set<string>
  skills: SkillBook
  history: QuickHistoryEntry[]
  strategy: QuickStrategy
  remainingMs: number | null
  now: Date
  random: () => number
}

type Weights = Record<'review' | 'continue' | 'new' | 'challenge', number>

export const STRATEGY_WEIGHTS: Record<QuickStrategy, Weights> = {
  auto: { review: 0.4, continue: 0.3, new: 0.2, challenge: 0.1 },
  'review-first': { review: 0.7, continue: 0.2, new: 0.1, challenge: 0 },
  'progress-first': { review: 0.15, continue: 0.5, new: 0.2, challenge: 0.15 },
}

const WEAKNESS_WEIGHT = 1
const STALENESS_WEIGHT = 0.5
const STALE_AFTER_DAYS = 14
const SHORT_REMAINING_MS = 60_000
const RECENTLY_USED_ITEMS = 2
const CHALLENGE_AHEAD_STAGES = 2
const QUICK_PATTERN_BARS = 2

export const QUICK_ITEM_LABELS: Record<QuickItemKind, string> = {
  continue: '이어서',
  review: '복습',
  new: '처음 보는 패턴',
  challenge: '도전',
  easier: '쉽게 다시',
}

function freshPattern(stage: Stage, random: () => number, label: string): RhythmPattern {
  const seed = Math.floor(random() * 1_000_000)
  const pattern = generateFromCells({ ...stage.spec, bars: QUICK_PATTERN_BARS }, seed)
  return { ...pattern, id: `${stage.id}-quick-${seed}`, title: `${stage.title} ${label}` }
}

function item(kind: QuickItemKind, stage: Stage, pattern: RhythmPattern): QuickItem {
  return { kind, stage, pattern, skillKey: skillKeyOf(stage) }
}

function reviewStage(input: CurationInput): Stage | null {
  const recentKeys = new Set(input.history.slice(-RECENTLY_USED_ITEMS).map((entry) => entry.skillKey))
  const scored = STAGES.filter((stage) => input.clearedStageIds.has(stage.id) && !recentKeys.has(skillKeyOf(stage))).map(
    (stage) => {
      const entry = input.skills[skillKeyOf(stage)]
      const staleness = Math.min(daysSincePractice(entry, input.now), STALE_AFTER_DAYS) / STALE_AFTER_DAYS
      return { stage, score: WEAKNESS_WEIGHT * weakness(entry) + STALENESS_WEIGHT * staleness }
    },
  )
  scored.sort((left, right) => right.score - left.score || right.stage.number - left.stage.number)
  return scored[0]?.stage ?? null
}

function continueItem(input: CurationInput): QuickItem {
  const stage = STAGES[currentStageIndex(input.clearedStageIds)]
  return item('continue', stage, freshPattern(stage, input.random, QUICK_ITEM_LABELS.continue))
}

function easierStage(stage: Stage): Stage {
  if (stage.part <= 1) {
    return stage
  }
  return STAGES.find((candidate) => candidate.figureId === stage.figureId && candidate.section === stage.section && candidate.part === stage.part - 1 && candidate.kind === stage.kind) ?? stage
}

function pickWeighted(weights: Partial<Weights>, random: () => number): keyof Weights {
  const entries = Object.entries(weights).filter(([, weight]) => (weight ?? 0) > 0) as [keyof Weights, number][]
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [kind, weight] of entries) {
    roll -= weight
    if (roll < 0) {
      return kind
    }
  }
  return entries[entries.length - 1][0]
}

export function nextQuickItem(input: CurationInput): QuickItem {
  const { history, random } = input
  const last = history[history.length - 1]
  const lastStage = last ? STAGES.find((stage) => stage.id === last.stageId) : undefined
  if (last && lastStage && last.score === 0) {
    const stage = easierStage(lastStage)
    return item('easier', stage, freshPattern(stage, random, QUICK_ITEM_LABELS.easier))
  }

  const review = reviewStage(input)
  if (input.remainingMs !== null && input.remainingMs < SHORT_REMAINING_MS && review) {
    return item('review', review, freshPattern(review, random, QUICK_ITEM_LABELS.review))
  }

  if (history.length === 0) {
    return input.strategy === 'review-first' && review
      ? item('review', review, freshPattern(review, random, QUICK_ITEM_LABELS.review))
      : continueItem(input)
  }

  const currentIndex = currentStageIndex(input.clearedStageIds)
  const challengeStage = STAGES[Math.min(STAGES.length - 1, currentIndex + CHALLENGE_AHEAD_STAGES)]
  const weights: Partial<Weights> = { ...STRATEGY_WEIGHTS[input.strategy] }
  if (!review) {
    delete weights.review
  }
  if (challengeStage.number - 1 === currentIndex) {
    delete weights.challenge
  }
  const lastTwo = history.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every((entry) => entry.score === 1)) {
    delete weights.continue
    delete weights.review
  }

  const kind = Object.keys(weights).length === 0 ? 'continue' : pickWeighted(weights, random)
  if (kind === 'review' && review) {
    return item('review', review, freshPattern(review, random, QUICK_ITEM_LABELS.review))
  }
  if (kind === 'challenge') {
    return item('challenge', challengeStage, freshPattern(challengeStage, random, QUICK_ITEM_LABELS.challenge))
  }
  if (kind === 'new') {
    const stage = STAGES[currentIndex]
    return item('new', stage, freshPattern(stage, random, QUICK_ITEM_LABELS.new))
  }
  return continueItem(input)
}

export function quickTimeUp(activeMs: number, targetMs: number | null): boolean {
  return targetMs !== null && activeMs >= targetMs
}
