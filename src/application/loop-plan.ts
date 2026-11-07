import { generateExpectedEvents } from '../domain/rhythm/event-generator.ts'
import type { ExpectedEvent } from '../domain/rhythm/event-generator.ts'
import { fractionToNumber } from '../domain/rhythm/fraction.ts'
import { patternLength } from '../domain/rhythm/pattern.ts'
import type { RhythmPattern } from '../domain/rhythm/pattern.ts'
import type { GuideMode, PracticeMode, ScheduledSound, SoundKind } from './practice-types.ts'

export type LoopSettings = {
  mode: PracticeMode
  bpm: number
  guide: GuideMode
}

export type LoopPhase = 'ready' | 'preview' | 'count-in' | 'perform'

export type LoopPlan = {
  introSounds: ScheduledSound[]
  performStartMs: number
  patternMs: number
  barMs: number
  beatMs: number
  beatsPerBar: number
  soundsForRepetition: (repetition: number) => ScheduledSound[]
  expectedForRepetition: (repetition: number) => ExpectedEvent[]
  isMutedRepetitionBar: (repetition: number, barInPattern: number) => boolean
  phaseAt: (elapsedMs: number) => LoopPhase
}

const MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM = 240000

// 다운·업과 왼손·오른손이 소리로 구별되게 음색을 나눈다.
export function patternSoundKind(event: ExpectedEvent, rightTrackId?: string): SoundKind {
  if (event.direction) {
    return event.direction === 'down' ? 'strum-down' : 'strum-up'
  }
  return event.trackId === rightTrackId ? 'note-high' : 'note'
}

export function patternSound(event: ExpectedEvent, timeMs: number, rightTrackId?: string): ScheduledSound {
  return { timeMs, kind: patternSoundKind(event, rightTrackId), ...(event.accent ? { stressed: true } : {}) }
}

export function rightTrackIdOf(pattern: RhythmPattern): string | undefined {
  return pattern.tracks.length > 1 ? pattern.tracks.find((track) => track.role === 'right')?.id : undefined
}

export function buildLoopPlan(pattern: RhythmPattern, settings: LoopSettings): LoopPlan {
  const wholeNoteMs = MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM / settings.bpm
  const beatsPerBar = pattern.timeSignature.numerator
  const beatMs = wholeNoteMs / pattern.timeSignature.denominator
  const barMs = beatMs * beatsPerBar
  const patternMs = fractionToNumber(patternLength(pattern)) * wholeNoteMs

  const clicks = (startMs: number, bars: number): ScheduledSound[] =>
    Array.from({ length: bars * beatsPerBar }, (_, beat) => ({
      timeMs: startMs + beat * beatMs,
      kind: beat % beatsPerBar === 0 ? 'accent' : 'beat',
    }))

  const introSounds: ScheduledSound[] = []
  let previewEndMs = 0
  if (settings.mode === 'imitation') {
    introSounds.push(...clicks(0, pattern.bars))
    for (const event of generateExpectedEvents(pattern, { bpm: settings.bpm })) {
      introSounds.push(patternSound(event, event.targetTimeMs, rightTrackIdOf(pattern)))
    }
    previewEndMs = patternMs
  } else {
    introSounds.push(...clicks(0, 1))
  }
  const performStartMs = settings.mode === 'imitation' ? previewEndMs : barMs

  const isMutedRepetitionBar = (repetition: number, barInPattern: number) =>
    settings.guide === 'gap' && (repetition * pattern.bars + barInPattern) % 2 === 1

  const soundsForRepetition = (repetition: number): ScheduledSound[] => {
    const start = performStartMs + repetition * patternMs
    const sounds: ScheduledSound[] = []
    for (let bar = 0; bar < pattern.bars; bar++) {
      if (settings.guide === 'none' || isMutedRepetitionBar(repetition, bar)) {
        continue
      }
      const barClicks = clicks(start + bar * barMs, 1)
      sounds.push(...(settings.guide === 'first-beat' ? barClicks.slice(0, 1) : barClicks))
    }
    return sounds
  }

  const expectedForRepetition = (repetition: number): ExpectedEvent[] =>
    generateExpectedEvents(pattern, {
      bpm: settings.bpm,
      startTimeMs: performStartMs + repetition * patternMs,
    }).map((event) => ({ ...event, id: `${event.trackId}:${event.patternEventId}:${repetition}`, repetition }))

  const phaseAt = (elapsedMs: number): LoopPhase => {
    if (elapsedMs < 0) {
      return 'ready'
    }
    if (elapsedMs >= performStartMs) {
      return 'perform'
    }
    return settings.mode === 'imitation' ? 'preview' : 'count-in'
  }

  return {
    introSounds,
    performStartMs,
    patternMs,
    barMs,
    beatMs,
    beatsPerBar,
    soundsForRepetition,
    expectedForRepetition,
    isMutedRepetitionBar,
    phaseAt,
  }
}
