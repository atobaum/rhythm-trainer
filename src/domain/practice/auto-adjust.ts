import { DEFAULT_TEMPO_POLICY } from './auto-tempo.ts'
import type { BarOutcome } from './bar-flow.ts'

export const GUIDE_FADE_ORDER = ['every-beat', 'first-beat', 'gap', 'none'] as const
export type GuideLevel = (typeof GUIDE_FADE_ORDER)[number]

export type AutoAdjustOptions = {
  tempoRamp: boolean
  guideFade: boolean
  guideCeiling: GuideLevel
}

export type AutoAdjustState = {
  cleanStreak: number
  tempoRaised: boolean
}

export type AutoAdjustValues = {
  bpm: number
  guide: GuideLevel
}

export type AutoAdjustStep = {
  state: AutoAdjustState
  change: AutoAdjustValues | null
}

export const INITIAL_AUTO_ADJUST: AutoAdjustState = { cleanStreak: 0, tempoRaised: false }

const CLEAN_STREAK_TO_ADJUST = 2
const TEMPO_STEP_BPM = 5

function guideAt(level: number): GuideLevel {
  return GUIDE_FADE_ORDER[Math.min(GUIDE_FADE_ORDER.length - 1, Math.max(0, level))]
}

export function nextAutoAdjust(options: AutoAdjustOptions, state: AutoAdjustState, current: AutoAdjustValues, outcome: BarOutcome): AutoAdjustStep {
  if (!options.tempoRamp && !options.guideFade) {
    return { state, change: null }
  }
  const guideLevel = GUIDE_FADE_ORDER.indexOf(current.guide)
  if (outcome === 'skip') {
    return { state: { ...state, cleanStreak: 0 }, change: null }
  }
  if (outcome === 'retry') {
    const ceilingLevel = GUIDE_FADE_ORDER.indexOf(options.guideCeiling)
    const backOff = options.guideFade && guideLevel > ceilingLevel
    return {
      state: { ...state, cleanStreak: 0 },
      change: backOff ? { ...current, guide: guideAt(guideLevel - 1) } : null,
    }
  }
  const cleanStreak = state.cleanStreak + 1
  if (cleanStreak < CLEAN_STREAK_TO_ADJUST) {
    return { state: { ...state, cleanStreak }, change: null }
  }
  const bpm = options.tempoRamp ? Math.min(DEFAULT_TEMPO_POLICY.maximumBpm, current.bpm + TEMPO_STEP_BPM) : current.bpm
  const guide = options.guideFade ? guideAt(guideLevel + 1) : current.guide
  if (bpm === current.bpm && guide === current.guide) {
    return { state: { ...state, cleanStreak }, change: null }
  }
  return {
    state: { cleanStreak: 0, tempoRaised: state.tempoRaised || bpm !== current.bpm },
    change: { bpm, guide },
  }
}
