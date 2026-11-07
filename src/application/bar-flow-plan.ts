import { DEFAULT_WINDOWS } from '../domain/evaluation/matcher.ts'
import { generateExpectedEvents } from '../domain/rhythm/event-generator.ts'
import type { ExpectedEvent } from '../domain/rhythm/event-generator.ts'
import type { RhythmPattern } from '../domain/rhythm/pattern.ts'
import { patternSound, rightTrackIdOf } from './loop-plan.ts'
import type { LoopSettings } from './loop-plan.ts'
import type { ScheduledSound } from './practice-types.ts'

export type SlotKind = 'listen' | 'play'

export type FlowSlot = {
  kind: SlotKind
  unitIndex: number
}

// 시간을 연습 단위(몇 마디) 길이의 칸으로 나눈다. 칸에 어떤 단위를 어떻게 놓을지는 앞 칸의 결과로 정해진다.
export type BarFlowPlan = {
  barMs: number
  beatMs: number
  slotMs: number
  barsPerUnit: number
  firstSlotMs: number
  countInSounds: ScheduledSound[]
  slotStartMs: (slot: number) => number
  slotAt: (elapsedMs: number) => number
  decisionMs: (slot: number) => number
  slotsForUnit: (unitIndex: number, firstTime: boolean) => FlowSlot[]
  isMutedBar: (flowSlot: FlowSlot, barInUnit: number) => boolean
  soundsForSlot: (slot: number, flowSlot: FlowSlot, unit: RhythmPattern) => ScheduledSound[]
  expectedForSlot: (slot: number, unit: RhythmPattern) => ExpectedEvent[]
}

const MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM = 240000

export function buildBarFlowPlan(beatsPerBar: number, barsPerUnit: number, settings: LoopSettings): BarFlowPlan {
  const beatMs = MILLISECONDS_PER_WHOLE_NOTE_AT_ONE_BPM / settings.bpm / 4
  const barMs = beatMs * beatsPerBar
  const slotMs = barMs * barsPerUnit
  const firstSlotMs = barMs
  const imitation = settings.mode === 'imitation'

  const clicks = (startMs: number): ScheduledSound[] =>
    Array.from({ length: beatsPerBar }, (_, beat) => ({ timeMs: startMs + beat * beatMs, kind: beat === 0 ? 'accent' : 'beat' }))

  const slotStartMs = (slot: number) => firstSlotMs + slot * slotMs

  // 듣고 따라 치기는 단위를 처음 칠 때만 들려주고, 틀려서 다시 칠 때는 바로 친다.
  const slotsForUnit = (unitIndex: number, firstTime: boolean): FlowSlot[] =>
    imitation && firstTime ? [{ kind: 'listen', unitIndex }, { kind: 'play', unitIndex }] : [{ kind: 'play', unitIndex }]

  const isMutedBar = (flowSlot: FlowSlot, barInUnit: number) =>
    settings.guide === 'gap' && flowSlot.kind === 'play' && barInUnit % 2 === 1

  const clicksForBar = (startMs: number, flowSlot: FlowSlot, barInUnit: number): ScheduledSound[] => {
    const barClicks = clicks(startMs)
    if (flowSlot.kind === 'listen' || settings.guide === 'every-beat' || (settings.guide === 'gap' && !isMutedBar(flowSlot, barInUnit))) {
      return barClicks
    }
    return settings.guide === 'first-beat' ? barClicks.slice(0, 1) : []
  }

  const expectedForSlot = (slot: number, unit: RhythmPattern): ExpectedEvent[] =>
    generateExpectedEvents(unit, { bpm: settings.bpm, startTimeMs: slotStartMs(slot) }).map((event) => ({
      ...event,
      id: `${event.trackId}:${event.patternEventId}:${slot}`,
      repetition: slot,
    }))

  return {
    barMs,
    beatMs,
    slotMs,
    barsPerUnit,
    firstSlotMs,
    countInSounds: clicks(0),
    slotStartMs,
    slotAt: (elapsedMs) => Math.floor((elapsedMs - firstSlotMs) / slotMs),
    decisionMs: (slot) => slotStartMs(slot + 1) - DEFAULT_WINDOWS.goodMs,
    slotsForUnit,
    isMutedBar,
    soundsForSlot: (slot, flowSlot, unit) => [
      ...Array.from({ length: barsPerUnit }, (_, bar) => clicksForBar(slotStartMs(slot) + bar * barMs, flowSlot, bar)).flat(),
      ...(flowSlot.kind === 'listen'
        ? expectedForSlot(slot, unit).map((event) => patternSound(event, event.targetTimeMs, rightTrackIdOf(unit)))
        : []),
    ],
    expectedForSlot,
  }
}
