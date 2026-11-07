import type { RhythmPattern } from '../domain/rhythm/pattern.ts'
import { buildLoopPlan, patternSound, rightTrackIdOf } from './loop-plan.ts'
import type { ScheduledSound } from './practice-types.ts'

// 한 마디 세고 나서 박 소리와 함께 리듬을 한 번 들려준다.
export function dictationSounds(pattern: RhythmPattern, bpm: number): { sounds: ScheduledSound[]; durationMs: number } {
  const plan = buildLoopPlan(pattern, { mode: 'reading', bpm, guide: 'every-beat' })
  const notes = plan.expectedForRepetition(0).map((event) => patternSound(event, event.targetTimeMs, rightTrackIdOf(pattern)))
  return {
    sounds: [...plan.introSounds, ...plan.soundsForRepetition(0), ...notes].sort((left, right) => left.timeMs - right.timeMs),
    durationMs: plan.performStartMs + plan.patternMs,
  }
}
