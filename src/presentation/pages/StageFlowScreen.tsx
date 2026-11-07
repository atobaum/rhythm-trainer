import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateSlot, tapsInSlot } from '../../application/bar-flow-evaluation.ts'
import type { BarFlowPlan, FlowSlot } from '../../application/bar-flow-plan.ts'
import { DEFAULT_WINDOWS } from '../../domain/evaluation/matcher.ts'
import type { Judgement, Tap } from '../../domain/evaluation/matcher.ts'
import type { PracticeMetrics } from '../../domain/evaluation/metrics.ts'
import { createBarFlow, recordBar } from '../../domain/practice/bar-flow.ts'
import type { ExpectedEvent } from '../../domain/rhythm/event-generator.ts'
import type { BarFlow, BarOutcome } from '../../domain/practice/bar-flow.ts'
import type { Stage } from '../../domain/curriculum/stages.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import ErrorMeter from '../components/ErrorMeter.tsx'
import ScoreView from '../components/ScoreView.tsx'
import type { PositionToX } from '../components/ScoreView.tsx'
import TimingTrack from '../components/TimingTrack.tsx'
import { useAudioClock } from '../hooks/use-audio-clock.ts'
import type { StoredSettings } from '../practice-settings.ts'
import { tapZonesFor, zoneForKey } from '../tap-zones.ts'
import type { TapZone } from '../tap-zones.ts'

export type StageFlowResult = {
  flow: BarFlow
  units: RhythmPattern[]
  bpm: number
  lastMetrics: (PracticeMetrics | null)[]
}

type Props = {
  stage: Stage
  units: RhythmPattern[]
  settings: StoredSettings
  plan: BarFlowPlan
  audioStart: number
  scheduledSlots: number
  onFinish: (result: StageFlowResult) => void
  onCancel: (reason?: string) => void
}

type FlowState = {
  flow: BarFlow
  slots: FlowSlot[]
  decisions: Record<number, BarOutcome>
  lastMetrics: (PracticeMetrics | null)[]
  pendingSlot: number
}

type FlowInput = {
  units: RhythmPattern[]
  plan: BarFlowPlan
  taps: Tap[]
  skippedSlots: Set<number>
  scoringOriginMs: number
  nowMs: number
}

function absoluteExpected(input: FlowInput, slot: number, unitIndex: number): ExpectedEvent[] {
  return input.plan
    .expectedForSlot(slot, input.units[unitIndex])
    .map((event) => ({ ...event, targetTimeMs: input.scoringOriginMs + event.targetTimeMs }))
}

function slotWindow(input: FlowInput, slot: number) {
  return { startMs: input.scoringOriginMs + input.plan.slotStartMs(slot), decisionMs: input.scoringOriginMs + input.plan.decisionMs(slot) }
}

// 마디 결과는 탭, 시각, 건너뛰기만으로 정해지므로 저장하지 않고 매번 처음 칸부터 다시 계산한다.
function deriveFlow(input: FlowInput): FlowState {
  const { units, plan } = input
  let flow = createBarFlow(units.length)
  const slots: FlowSlot[] = plan.slotsForUnit(0, true)
  const decisions: Record<number, BarOutcome> = {}
  const lastMetrics: (PracticeMetrics | null)[] = new Array(units.length).fill(null)
  let slot = slots.length - 1
  for (;;) {
    let outcome: BarOutcome
    if (input.skippedSlots.has(slot)) {
      outcome = 'skip'
    } else {
      const evaluation = evaluateSlot(absoluteExpected(input, slot, slots[slot].unitIndex), input.taps, slotWindow(input, slot), input.nowMs)
      if (evaluation.verdict === 'pending') {
        break
      }
      outcome = evaluation.verdict
      lastMetrics[flow.index] = evaluation.metrics
    }
    decisions[slot] = outcome
    const previousIndex = flow.index
    flow = recordBar(flow, outcome)
    if (flow.finished) {
      break
    }
    slots.push(...plan.slotsForUnit(flow.index, flow.index !== previousIndex))
    slot = slots.length - 1
  }
  return { flow, slots, decisions, lastMetrics, pendingSlot: slot }
}

const CLOCK_FREEZE_BEFORE_PERFORM_MS = 200
const RECENT_TAP_COUNT = 8

function outcomeMessage(outcome: BarOutcome | undefined, metrics: PracticeMetrics | null, advanced: boolean): string {
  if (outcome === undefined) {
    return '깔끔하게 치면 다음 두 마디로 넘어가요'
  }
  if (outcome === 'clean') {
    return advanced ? '깔끔해요! 다음 두 마디' : '깔끔해요! 한 번 더 깔끔하면 다음으로'
  }
  if (outcome === 'skip') {
    return '건너뛰었어요'
  }
  if (metrics && (metrics.missCount > 0 || metrics.extraCount > 0)) {
    return `다시 · Miss ${metrics.missCount} · Extra ${metrics.extraCount}`
  }
  if (metrics && metrics.directionErrorCount > 0) {
    return `다시 · 방향 틀림 ${metrics.directionErrorCount}`
  }
  return `다시 · 평균 오차 ${Math.round(metrics?.meanAbsoluteErrorMs ?? 0)}ms`
}

export default function StageFlowScreen({ stage, units, settings, plan, audioStart, scheduledSlots, onFinish, onCancel }: Props) {
  const [taps, setTaps] = useState<Tap[]>([])
  const [skippedSlots, setSkippedSlots] = useState<Set<number>>(() => new Set())
  const finishedRef = useRef(false)
  const scheduledRef = useRef(new Set<number>())
  const clock = useAudioClock(audioStart, plan.firstSlotMs - CLOCK_FREEZE_BEFORE_PERFORM_MS)
  const { nowMs } = clock
  const scoringOriginMs = clock.originMs + settings.latencyOffsetMs
  const zones = useMemo(() => tapZonesFor(units[0], settings.strumInput === 'split'), [units, settings.strumInput])
  const [positionToX, setPositionToX] = useState<PositionToX>(() => (position: number) => position)
  const handleScoreLayout = useCallback((mapping: PositionToX) => setPositionToX(() => mapping), [])

  const flowInput: FlowInput = { units, plan, taps, skippedSlots, scoringOriginMs, nowMs }
  const state = deriveFlow(flowInput)
  const { pendingSlot } = state

  useEffect(() => {
    state.slots.forEach((flowSlot, slot) => {
      if (slot >= scheduledSlots && !scheduledRef.current.has(slot)) {
        scheduledRef.current.add(slot)
        audioEngine.appendToSession(plan.soundsForSlot(slot, flowSlot, units[flowSlot.unitIndex]))
      }
    })
  }, [state.slots, plan, units, scheduledSlots])

  useEffect(() => {
    if (state.flow.finished && !finishedRef.current) {
      finishedRef.current = true
      onFinish({ flow: state.flow, units, bpm: settings.bpm, lastMetrics: state.lastMetrics })
    }
  }, [state.flow, state.lastMetrics, units, settings.bpm, onFinish])

  const recordTap = useCallback(
    (timeMs: number, zone: TapZone) => {
      if (finishedRef.current || timeMs - clock.originMs < plan.firstSlotMs - DEFAULT_WINDOWS.goodMs) {
        return
      }
      setTaps((previous) => [
        ...previous,
        { id: `tap${previous.length}`, timeMs, trackId: zone.trackId, ...(zone.direction ? { direction: zone.direction } : {}) },
      ])
    },
    [clock.originMs, plan],
  )

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      const zone = zoneForKey(zones, event.key)
      if (zone === null) {
        return
      }
      event.preventDefault()
      recordTap(event.timeStamp, zone)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onCancel('화면이 가려져서 연습을 중단했어요.')
      }
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [recordTap, onCancel, zones])

  const elapsedMs = nowMs - clock.originMs
  const countingIn = elapsedMs < plan.firstSlotMs
  const shownSlot = countingIn ? 0 : Math.min(plan.slotAt(elapsedMs), state.slots.length - 1)
  const shownUnitIndex = state.slots[shownSlot].unitIndex
  const shownUnit = units[shownUnitIndex]
  const listening = state.slots[shownSlot].kind === 'listen'
  const hideScore = settings.mode === 'imitation' && settings.hideScoreWhileImitating

  const playSlotOfShown = listening ? shownSlot + 1 : shownSlot
  const decidedPreview = state.slots[playSlotOfShown + 1]?.unitIndex
  const previewUnitIndex = decidedPreview ?? (shownUnitIndex + 1 < units.length ? shownUnitIndex + 1 : null)
  const previewLabelFor = () =>
    previewUnitIndex === null ? '마지막 마디예요' : decidedPreview === shownUnitIndex ? (state.decisions[playSlotOfShown] === 'clean' ? '한 번 더' : '다시') : `다음 · ${barRange(previewUnitIndex)}`

  const shownExpected = absoluteExpected(flowInput, shownSlot, shownUnitIndex)
  const shownEvaluation = evaluateSlot(shownExpected, taps, slotWindow(flowInput, shownSlot), nowMs)
  const judgements: Judgement[] = !countingIn && !listening ? shownEvaluation.judgements : []
  const slotStart = scoringOriginMs + plan.slotStartMs(shownSlot)
  const positionOf = (timeMs: number) => (timeMs - slotStart) / plan.slotMs
  const matchedTapIds = new Set(judgements.flatMap((judgement) => (judgement.kind === 'miss' ? [] : [judgement.tap.id])))
  const pendingTaps = countingIn || listening ? [] : tapsInSlot(taps, slotWindow(flowInput, shownSlot)).filter((tap) => !matchedTapIds.has(tap.id))
  const trackIds = shownUnit.tracks.map((track) => track.id)
  const judgementTrack = (judgement: Judgement) => (judgement.kind === 'extra' ? judgement.tap.trackId : judgement.expected.trackId)
  const recentTaps = judgements
    .flatMap((judgement) => (judgement.kind === 'miss' ? [] : [judgement]))
    .slice(-RECENT_TAP_COUNT)
  const cursor = countingIn ? null : (elapsedMs - plan.slotStartMs(shownSlot)) / plan.slotMs
  const targets = countingIn || listening ? [] : shownExpected

  const attemptsHere = Object.keys(state.decisions)
    .map(Number)
    .filter((slot) => slot < shownSlot && state.slots[slot].unitIndex === shownUnitIndex).length
  const lastDecidedSlot = Math.max(-1, ...Object.keys(state.decisions).map(Number).filter((slot) => slot <= shownSlot))
  const lastOutcome = lastDecidedSlot >= 0 ? state.decisions[lastDecidedSlot] : undefined
  const lastAdvanced = lastDecidedSlot >= 0 && state.slots[lastDecidedSlot + 1]?.unitIndex !== state.slots[lastDecidedSlot].unitIndex
  const lastOutcomeMetrics = lastDecidedSlot >= 0 ? state.lastMetrics[state.slots[lastDecidedSlot].unitIndex] : null

  const totalBars = units.length * plan.barsPerUnit
  const barRange = (unitIndex: number) => `${unitIndex * plan.barsPerUnit + 1}–${(unitIndex + 1) * plan.barsPerUnit}/${totalBars}마디`

  let status: string
  if (countingIn) {
    status = `${Math.ceil((plan.firstSlotMs - elapsedMs) / plan.beatMs)}`
  } else if (listening) {
    status = `${barRange(shownUnitIndex)} · 잘 들어보세요`
  } else {
    const barInUnit = Math.min(plan.barsPerUnit - 1, Math.floor((cursor ?? 0) * plan.barsPerUnit))
    status = `${barRange(shownUnitIndex)}${attemptsHere > 0 ? ` · ${attemptsHere + 1}번째` : ''}${plan.isMutedBar(state.slots[shownSlot], barInUnit) ? ' · 소리 없이 세기' : ''}`
  }

  return (
    <div className="session">
      <header className="session-header">
        <button type="button" className="link-button" onClick={() => onCancel()}>
          ← 그만하기
        </button>
        <span className="muted">
          {stage.number}. {stage.title} · {settings.bpm} BPM
        </span>
        <button type="button" className="link-button" onClick={() => setSkippedSlots((previous) => new Set([...previous, pendingSlot]))}>
          건너뛰기 →
        </button>
      </header>

      <div className={`session-status ${countingIn ? 'session-count' : ''}`}>{status}</div>
      <div className="loop-progress">
        <div className="bar-dots">
          {units.map((bar, index) => (
            <span
              key={bar.id}
              className={`bar-dot ${index < state.flow.index || state.flow.finished ? (state.flow.skipped[index] ? 'bar-dot-skipped' : 'bar-dot-done') : ''} ${index === shownUnitIndex ? 'bar-dot-current' : ''}`}
            />
          ))}
        </div>
      </div>
      <p className="muted small flow-message">{outcomeMessage(lastOutcome, lastOutcomeMetrics, lastAdvanced)}</p>

      <section className="session-score">
        <ScoreView
          pattern={shownUnit}
          hidden={hideScore}
          cursorX={hideScore || cursor === null ? null : positionToX(cursor)}
          onLayout={handleScoreLayout}
        />
        {trackIds.map((trackId) => (
          <div key={trackId} className={trackIds.length > 1 ? 'hand-track' : undefined}>
            {trackIds.length > 1 && <span className="hand-label">{trackId === 'left' ? 'L' : 'R'}</span>}
            <TimingTrack
              targets={targets.filter((event) => event.trackId === trackId)}
              judgements={judgements.filter((judgement) => judgementTrack(judgement) === trackId)}
              pendingTapPositions={pendingTaps.filter((tap) => tap.trackId === trackId).map((tap) => positionToX(positionOf(tap.timeMs)))}
              positionOf={(timeMs) => positionToX(positionOf(timeMs))}
              cursor={cursor === null || listening ? null : positionToX(cursor)}
            />
          </div>
        ))}
        <ErrorMeter recent={recentTaps} />
        <div className={`bar-preview ${decidedPreview === shownUnitIndex ? 'bar-preview-retry' : ''}`}>
          <span className="bar-preview-label">{previewLabelFor()}</span>
          {previewUnitIndex !== null && !hideScore && <ScoreView pattern={units[previewUnitIndex]} />}
        </div>
      </section>

      <div className="tap-zones">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="tap-area"
            role="button"
            tabIndex={-1}
            onPointerDown={(event) => {
              event.preventDefault()
              recordTap(event.nativeEvent.timeStamp, zone)
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {zone.label}
            <span className="tap-hint">{zone.hint}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
