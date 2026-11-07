import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { absoluteExpected, evaluateRepetitions, repetitionOfTime } from '../../application/loop-evaluation.ts'
import type { RepetitionResult } from '../../application/loop-evaluation.ts'
import type { LoopPlan } from '../../application/loop-plan.ts'
import { DEFAULT_WINDOWS, judgementTimeMs, matchEvents } from '../../domain/evaluation/matcher.ts'
import type { Judgement, Tap } from '../../domain/evaluation/matcher.ts'
import { computeMetrics } from '../../domain/evaluation/metrics.ts'
import type { PracticeMetrics } from '../../domain/evaluation/metrics.ts'
import { cleanRepetitionsNeeded, loopPassed, trailingCleanCount } from '../../domain/practice/loop-progress.ts'
import type { ExpectedEvent } from '../../domain/rhythm/event-generator.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import ErrorMeter from '../components/ErrorMeter.tsx'
import LiveControls from '../components/LiveControls.tsx'
import type { LiveChange } from '../components/LiveControls.tsx'
import ScoreRows from '../components/ScoreRows.tsx'
import TimingTrack from '../components/TimingTrack.tsx'
import { useAudioClock } from '../hooks/use-audio-clock.ts'
import { tapSoundKind, tapZonesFor, zoneForKey } from '../tap-zones.ts'
import type { TapZone } from '../tap-zones.ts'
import type { StoredSettings } from '../practice-settings.ts'

export type SessionResult = {
  judgements: Judgement[]
  metrics: PracticeMetrics
  expectedEvents: ExpectedEvent[]
  firstRepetitionStartMs: number
  patternMs: number
  repetitions: number
  bpm: number
  barMs: number
  beatMs: number
  beatsPerBar: number
  mutedBars: number[]
  passed: boolean
  repetitionsPlayed: number
  change: LiveChange | null
}

export type LoopResume = {
  cleanFlags: boolean[]
  repetitionsPlayed: number
  change: LiveChange
}

type Props = {
  pattern: RhythmPattern
  settings: StoredSettings
  plan: LoopPlan
  audioStart: number
  scheduledRepetitions: number
  progressLabel: string | null
  priorCleanFlags?: boolean[]
  onFinish: (result: SessionResult) => void
  onRestart: (resume: LoopResume) => void
  onCancel: (reason?: string) => void
}

const CLOCK_FREEZE_BEFORE_PERFORM_MS = 200
const NO_PRIOR_FLAGS: boolean[] = []
const SCHEDULE_AHEAD_REPETITIONS = 3
const SCHEDULER_INTERVAL_MS = 200
const RECENT_TAP_COUNT = 8
const SHOWN_REPETITIONS = 4

function buildDisplay(
  plan: LoopPlan,
  pattern: RhythmPattern,
  originMs: number,
  results: RepetitionResult[],
  bpm: number,
  passed: boolean,
  priorRepetitions: number,
  change: LiveChange | null,
): SessionResult {
  const shown = results.slice(-SHOWN_REPETITIONS)
  const firstShown = shown[0]?.repetition ?? 0
  const reindex = (event: ExpectedEvent): ExpectedEvent => ({ ...event, repetition: event.repetition - firstShown })
  const judgements = shown
    .flatMap((result) => result.judgements)
    .map((judgement) => (judgement.kind === 'extra' ? judgement : { ...judgement, expected: reindex(judgement.expected) }))
  const mutedBars: number[] = []
  shown.forEach((result, index) => {
    for (let bar = 0; bar < pattern.bars; bar++) {
      if (plan.isMutedRepetitionBar(result.repetition, bar)) {
        mutedBars.push(index * pattern.bars + bar)
      }
    }
  })
  return {
    judgements,
    metrics: computeMetrics(judgements),
    expectedEvents: shown.flatMap((result) => absoluteExpected(plan, originMs, result.repetition).map(reindex)),
    firstRepetitionStartMs: originMs + plan.performStartMs + firstShown * plan.patternMs,
    patternMs: plan.patternMs,
    repetitions: shown.length,
    bpm,
    barMs: plan.barMs,
    beatMs: plan.beatMs,
    beatsPerBar: plan.beatsPerBar,
    mutedBars,
    passed,
    repetitionsPlayed: priorRepetitions + results.length,
    change,
  }
}

function lastRepetitionMessage(result: RepetitionResult | undefined, needed: number): string {
  if (result === undefined) {
    return '한 번에 깔끔하게 치면 바로 통과'
  }
  if (result.clean) {
    return `깔끔해요! ${needed}번 연속이면 통과`
  }
  const { missCount, extraCount, meanAbsoluteErrorMs, directionErrorCount } = result.metrics
  if (missCount > 0 || extraCount > 0) {
    return `지난 반복 Miss ${missCount} · Extra ${extraCount}`
  }
  if (directionErrorCount > 0) {
    return `지난 반복 방향 틀림 ${directionErrorCount}`
  }
  return `지난 반복 평균 오차 ${Math.round(meanAbsoluteErrorMs ?? 0)}ms`
}

export default function SessionScreen({
  pattern,
  settings,
  plan,
  audioStart,
  scheduledRepetitions,
  progressLabel,
  onFinish,
  priorCleanFlags = NO_PRIOR_FLAGS,
  onRestart,
  onCancel,
}: Props) {
  const [liveChange, setLiveChange] = useState<LiveChange | null>(null)
  const [changeRepetition, setChangeRepetition] = useState<number | null>(null)
  const [taps, setTaps] = useState<Tap[]>([])
  const finishedRef = useRef(false)
  const clock = useAudioClock(audioStart, plan.performStartMs - CLOCK_FREEZE_BEFORE_PERFORM_MS)
  const { nowMs } = clock
  const scoringOriginMs = clock.originMs + settings.latencyOffsetMs
  const zones = useMemo(() => tapZonesFor(pattern, settings.strumInput === 'split'), [pattern, settings.strumInput])

  useEffect(() => {
    let scheduled = scheduledRepetitions
    const timer = window.setInterval(() => {
      const elapsed = audioEngine.sessionElapsedMs()
      const current = Math.max(0, Math.floor((elapsed - plan.performStartMs) / plan.patternMs))
      while (scheduled <= current + SCHEDULE_AHEAD_REPETITIONS) {
        audioEngine.appendToSession(plan.soundsForRepetition(scheduled))
        scheduled++
      }
    }, SCHEDULER_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [plan, scheduledRepetitions])

  const elapsedMs = nowMs - clock.originMs
  const phase = plan.phaseAt(elapsedMs)
  const performing = phase === 'perform'
  const repetition = performing ? Math.floor((elapsedMs - plan.performStartMs) / plan.patternMs) : 0
  const completedRepetitions = Math.max(
    0,
    Math.floor((nowMs - scoringOriginMs - plan.performStartMs - DEFAULT_WINDOWS.goodMs) / plan.patternMs),
  )

  const results = useMemo(
    () => evaluateRepetitions(plan, scoringOriginMs, taps, completedRepetitions),
    [plan, scoringOriginMs, taps, completedRepetitions],
  )
  const cleanFlags = useMemo(() => [...priorCleanFlags, ...results.map((result) => result.clean)], [priorCleanFlags, results])
  const passed = loopPassed(cleanFlags)
  const cleanStreak = trailingCleanCount(cleanFlags)
  const cleanNeeded = cleanRepetitionsNeeded(cleanFlags)

  const finish = useCallback(
    (didPass: boolean) => {
      if (finishedRef.current) {
        return
      }
      finishedRef.current = true
      onFinish(buildDisplay(plan, pattern, scoringOriginMs, results, settings.bpm, didPass, priorCleanFlags.length, liveChange))
    },
    [plan, pattern, scoringOriginMs, results, settings.bpm, onFinish, priorCleanFlags.length, liveChange],
  )

  useEffect(() => {
    if (passed) {
      finish(true)
    }
  }, [passed, finish])

  // 바꾼 설정은 요청할 때 치던 반복의 판정이 끝나면 세션을 새로 시작해 적용한다.
  const restartDue = liveChange !== null && changeRepetition !== null && completedRepetitions > changeRepetition && !passed
  useEffect(() => {
    if (restartDue && liveChange && !finishedRef.current) {
      finishedRef.current = true
      onRestart({ cleanFlags, repetitionsPlayed: cleanFlags.length, change: liveChange })
    }
  }, [restartDue, liveChange, cleanFlags, onRestart])

  const recordTap = useCallback(
    (timeMs: number, zone: TapZone) => {
      if (settings.tapSound) {
        audioEngine.playNow(tapSoundKind(zone))
      }
      if (finishedRef.current || timeMs - clock.originMs < plan.performStartMs - DEFAULT_WINDOWS.goodMs) {
        return
      }
      setTaps((previous) => [
        ...previous,
        { id: `tap${previous.length}`, timeMs, trackId: zone.trackId, ...(zone.direction ? { direction: zone.direction } : {}) },
      ])
    },
    [clock.originMs, plan, settings.tapSound],
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

  const windowStart = Math.max(0, repetition - 1)
  const windowExpected = performing
    ? Array.from({ length: repetition - windowStart + 1 }, (_, offset) =>
        absoluteExpected(plan, scoringOriginMs, windowStart + offset),
      ).flat()
    : []
  const windowTaps = taps.filter((tap) => repetitionOfTime(plan, scoringOriginMs, tap.timeMs) >= windowStart)
  const dueEvents = windowExpected.filter((event) => event.targetTimeMs <= nowMs + DEFAULT_WINDOWS.goodMs)
  const liveJudgements = matchEvents(dueEvents, windowTaps).filter(
    (judgement) => judgement.kind !== 'miss' || judgement.expected.targetTimeMs < nowMs - DEFAULT_WINDOWS.goodMs,
  )
  const matchedTapIds = new Set(liveJudgements.flatMap((judgement) => (judgement.kind === 'miss' ? [] : [judgement.tap.id])))
  const repetitionStartMs = scoringOriginMs + plan.performStartMs + repetition * plan.patternMs
  const positionOf = (timeMs: number) => (timeMs - repetitionStartMs) / plan.patternMs
  const inCurrentRepetition = (timeMs: number) => repetitionOfTime(plan, scoringOriginMs, timeMs) === repetition
  const trackJudgements = liveJudgements.filter((judgement) =>
    judgement.kind === 'extra' ? inCurrentRepetition(judgement.tap.timeMs) : judgement.expected.repetition === repetition,
  )
  const pendingTaps = windowTaps.filter((tap) => !matchedTapIds.has(tap.id) && inCurrentRepetition(tap.timeMs))
  const trackIds = pattern.tracks.map((track) => track.id)
  const judgementTrack = (judgement: Judgement) => (judgement.kind === 'extra' ? judgement.tap.trackId : judgement.expected.trackId)
  const recentTaps = liveJudgements
    .flatMap((judgement) => (judgement.kind === 'miss' ? [] : [judgement]))
    .sort((left, right) => left.tap.timeMs - right.tap.timeMs)
    .slice(-RECENT_TAP_COUNT)

  const cursor = performing ? (elapsedMs - plan.performStartMs - repetition * plan.patternMs) / plan.patternMs : null
  const previewCursor = phase === 'preview' ? elapsedMs / plan.patternMs : null
  const shownCursor = cursor ?? previewCursor
  const hideScore = settings.mode === 'imitation' && settings.hideScoreWhileImitating

  let status = '준비'
  if (phase === 'preview') {
    status = '잘 들어보세요'
  } else if (phase === 'count-in') {
    status = `${Math.ceil((plan.performStartMs - elapsedMs) / plan.beatMs)}`
  } else if (performing) {
    const bar = Math.floor(((elapsedMs - plan.performStartMs) % plan.patternMs) / plan.barMs)
    status = `${repetition + 1}번째${plan.isMutedRepetitionBar(repetition, bar) ? ' · 소리 없이 세기' : ''}`
  }

  return (
    <div className="session">
      <header className="session-header">
        <button type="button" className="link-button" onClick={() => onCancel()}>
          ← 그만하기
        </button>
        <span className="muted">
          {progressLabel ? `${progressLabel} · ` : ''}
          {settings.bpm} BPM
        </span>
        <button type="button" className="link-button" onClick={() => finish(false)}>
          건너뛰기 →
        </button>
      </header>
      <LiveControls
        current={{ bpm: settings.bpm, guide: settings.guide }}
        pending={liveChange}
        untilLabel="다음 반복"
        onChange={(next) => {
          setLiveChange(next)
          setChangeRepetition((previous) => (next === null ? null : (previous ?? repetition)))
        }}
      />

      <div className={`session-status ${phase === 'count-in' ? 'session-count' : ''}`}>{status}</div>
      <div className="loop-progress">
        {Array.from({ length: cleanNeeded }, (_, index) => (
          <span key={index} className={index < cleanStreak ? 'streak-dot streak-on' : 'streak-dot'} />
        ))}
        <span className="muted small">{lastRepetitionMessage(results[results.length - 1], cleanNeeded)}</span>
      </div>

      <section className="session-score">
        <ScoreRows
          pattern={pattern}
          hidden={hideScore}
          cursor={shownCursor}
          renderTracks={(row) =>
            trackIds.map((trackId) => (
              <div key={trackId} className={trackIds.length > 1 ? 'hand-track' : undefined}>
                {trackIds.length > 1 && <span className="hand-label">{trackId === 'left' ? 'L' : 'R'}</span>}
                <TimingTrack
                  beats={row.beats}
                  targets={
                    performing
                      ? windowExpected.filter(
                          (event) => event.repetition === repetition && event.trackId === trackId && row.contains(positionOf(event.targetTimeMs)),
                        )
                      : []
                  }
                  judgements={
                    performing
                      ? trackJudgements.filter(
                          (judgement) => judgementTrack(judgement) === trackId && row.contains(positionOf(judgementTimeMs(judgement))),
                        )
                      : []
                  }
                  pendingTapPositions={
                    performing
                      ? pendingTaps
                          .filter((tap) => tap.trackId === trackId && row.contains(positionOf(tap.timeMs)))
                          .map((tap) => row.toX(positionOf(tap.timeMs)))
                      : []
                  }
                  positionOf={(timeMs) => row.toX(positionOf(timeMs))}
                  cursor={cursor === null || row.cursor === null ? null : row.toX(row.cursor)}
                />
              </div>
            ))
          }
        />
        <ErrorMeter recent={recentTaps} />
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
