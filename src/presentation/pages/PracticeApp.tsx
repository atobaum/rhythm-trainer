import { useCallback, useRef, useState } from 'react'
import { calibrationSounds } from '../../application/calibration-session.ts'
import { buildBarFlowPlan } from '../../application/bar-flow-plan.ts'
import type { BarFlowPlan } from '../../application/bar-flow-plan.ts'
import { buildLoopPlan } from '../../application/loop-plan.ts'
import type { LoopPlan } from '../../application/loop-plan.ts'
import { contentPatterns } from '../../content/patterns.ts'
import { tempoAfterLoop } from '../../domain/practice/loop-progress.ts'
import { starsFor } from '../../domain/practice/stars.ts'
import { REVIEW_BAR_ATTEMPTS, stageClearedBy, stageSkillScore, tempoAfterStage } from '../../domain/practice/bar-flow.ts'
import { BARS_PER_UNIT, STAGES, currentStageIndex, skillKeyOf, stageUnits } from '../../domain/curriculum/stages.ts'
import type { Stage } from '../../domain/curriculum/stages.ts'
import { QUICK_ITEM_LABELS, nextQuickItem, quickTimeUp } from '../../domain/curriculum/quick-curation.ts'
import type { QuickHistoryEntry } from '../../domain/curriculum/quick-curation.ts'
import { outcomeScore, weakness } from '../../domain/practice/skill.ts'
import { STRUM_PATTERNS } from '../../domain/rhythm/strum-patterns.ts'
import { singleHand } from '../../domain/rhythm/two-hand-patterns.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'
import { currentStreak, loadSkills, markPracticedToday, saveSkillScore } from '../learning-store.ts'
import { patternListFor, selectedIndex } from '../pattern-lists.ts'
import { hasStrum } from '../tap-zones.ts'
import type { PatternList } from '../pattern-lists.ts'
import { saveAttempt } from '../practice-records.ts'
import type { RecordUpdate } from '../practice-records.ts'
import { loadSettings, saveSettings } from '../practice-settings.ts'
import { loadStageProgress, markStageCleared } from '../stage-progress.ts'
import type { StoredSettings } from '../practice-settings.ts'
import CalibrationScreen from './CalibrationScreen.tsx'
import DictationScreen from './DictationScreen.tsx'
import ResultScreen from './ResultScreen.tsx'
import SessionScreen from './SessionScreen.tsx'
import type { SessionResult } from './SessionScreen.tsx'
import SetupScreen from './SetupScreen.tsx'
import StageFlowScreen from './StageFlowScreen.tsx'
import type { StageFlowResult } from './StageFlowScreen.tsx'
import type { SetupTab } from './SetupScreen.tsx'
import SummaryScreen from './SummaryScreen.tsx'
import type { PatternOutcome } from './SummaryScreen.tsx'

const INITIAL_SCHEDULED_REPETITIONS = 4
const EXTEND_MINUTES = 5
const MILLISECONDS_PER_MINUTE = 60_000

type QuickState = {
  targetMs: number | null
  activeMs: number
  history: QuickHistoryEntry[]
}

type Queue = {
  kind: 'patterns' | 'quick'
  patterns: RhythmPattern[]
  patternStages: (Stage | null)[]
  labels: (string | undefined)[]
  index: number
  outcomes: PatternOutcome[]
  quick: QuickState | null
  list: PatternList | null
}

type Screen =
  | { kind: 'setup' }
  | { kind: 'session'; attempt: number; plan: LoopPlan; audioStart: number; pattern: RhythmPattern }
  | { kind: 'result'; result: SessionResult; stars: number; record: RecordUpdate | null; tempoChange: number; pattern: RhythmPattern }
  | { kind: 'summary' }
  | { kind: 'stage-flow'; attempt: number; stage: Stage; units: RhythmPattern[]; plan: BarFlowPlan; audioStart: number }
  | { kind: 'stage-summary'; stage: Stage; result: StageFlowResult; tempoChange: number }
  | { kind: 'calibration'; attempt: number; audioStart: number }
  | { kind: 'dictation'; attempt: number; stage: Stage; seed: number }

function listForTarget(settings: StoredSettings): PatternList {
  return patternListFor(settings.target === 'stages' ? 'patterns' : settings.target, settings)
}

function clearedStageIds(): Set<string> {
  return new Set(Object.keys(loadStageProgress()))
}

const STRUM_EVERY_NTH_ITEM = 4

function strumQuickItem(queue: Queue): Queue {
  const skills = loadSkills()
  const ranked = [...STRUM_PATTERNS].sort(
    (left, right) => weakness(skills[`strum:${right.id}`]) - weakness(skills[`strum:${left.id}`]) || Math.random() - 0.5,
  )
  const pattern = ranked[0]
  return {
    ...queue,
    patterns: [...queue.patterns, pattern],
    patternStages: [...queue.patternStages, null],
    labels: [...queue.labels, `기타 스트로크 · ${pattern.title}`],
    index: queue.patterns.length,
  }
}

function withNextQuickItem(queue: Queue, settings: StoredSettings): Queue {
  const quick = queue.quick!
  const strategy = settings.quickStrategy
  if (settings.quickIncludeStrum && queue.patterns.length % STRUM_EVERY_NTH_ITEM === STRUM_EVERY_NTH_ITEM - 1) {
    return strumQuickItem(queue)
  }
  const item = nextQuickItem({
    clearedStageIds: clearedStageIds(),
    skills: loadSkills(),
    history: quick.history,
    strategy,
    remainingMs: quick.targetMs === null ? null : quick.targetMs - quick.activeMs,
    now: new Date(),
    random: Math.random,
  })
  return {
    ...queue,
    patterns: [...queue.patterns, item.pattern],
    patternStages: [...queue.patternStages, item.stage],
    labels: [...queue.labels, `${QUICK_ITEM_LABELS[item.kind]} · ${item.stage.number}. ${item.stage.title}`],
    index: queue.patterns.length,
  }
}

function quickQueue(settings: StoredSettings): Queue {
  const empty: Queue = {
    kind: 'quick',
    patterns: [],
    patternStages: [],
    labels: [],
    index: 0,
    outcomes: [],
    quick: {
      targetMs: settings.quickMinutes > 0 ? settings.quickMinutes * MILLISECONDS_PER_MINUTE : null,
      activeMs: 0,
      history: [],
    },
    list: null,
  }
  return withNextQuickItem(empty, settings)
}

function selectedStage(settings: StoredSettings): Stage {
  return (
    STAGES.find((stage) => stage.id === settings.selectedStageId) ??
    STAGES[currentStageIndex(new Set(Object.keys(loadStageProgress())))]
  )
}

export default function PracticeApp() {
  const [settings, setSettings] = useState<StoredSettings>(() => {
    const loaded = loadSettings()
    const patternExists = contentPatterns.some((pattern) => pattern.id === loaded.patternId)
    return patternExists ? loaded : { ...loaded, patternId: contentPatterns[0].id }
  })
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' })
  const [notice, setNotice] = useState<string | null>(null)
  const [setupTab, setSetupTab] = useState<SetupTab>('practice')
  const [queue, setQueue] = useState<Queue | null>(null)
  const attemptRef = useRef(0)

  const changeSettings = (next: StoredSettings) => {
    setSettings(next)
    saveSettings(next)
  }

  const unlockAudio = async () => {
    setNotice(null)
    try {
      await audioEngine.unlock()
      return true
    } catch {
      setNotice('소리를 켤 수 없어요. 브라우저 설정을 확인해 주세요.')
      return false
    }
  }

  const play = async (pattern: RhythmPattern, bpm: number) => {
    if (!(await unlockAudio())) {
      return
    }
    const played = pattern.tracks.length > 1 && settings.handFocus !== 'both' ? singleHand(pattern, settings.handFocus) : pattern
    const plan = buildLoopPlan(played, { mode: settings.mode, bpm, guide: settings.guide })
    const firstRepetitions = Array.from({ length: INITIAL_SCHEDULED_REPETITIONS }, (_, repetition) =>
      plan.soundsForRepetition(repetition),
    ).flat()
    attemptRef.current += 1
    setScreen({
      kind: 'session',
      attempt: attemptRef.current,
      plan,
      pattern: played,
      audioStart: audioEngine.playSession([...plan.introSounds, ...firstRepetitions]),
    })
  }

  const startStageFlow = async (stage: Stage) => {
    if (!(await unlockAudio())) {
      return
    }
    const units = stageUnits(stage, Math.floor(Math.random() * 1e9))
    const plan = buildBarFlowPlan(stage.spec.beatsPerBar, BARS_PER_UNIT, { mode: settings.mode, bpm: settings.bpm, guide: settings.guide })
    const firstSlots = plan.slotsForUnit(0, true)
    attemptRef.current += 1
    setScreen({
      kind: 'stage-flow',
      attempt: attemptRef.current,
      stage,
      units,
      plan,
      audioStart: audioEngine.playSession([
        ...plan.countInSounds,
        ...firstSlots.flatMap((flowSlot, slot) => plan.soundsForSlot(slot, flowSlot, units[0])),
      ]),
    })
  }

  const finishStageFlow = useCallback(
    (stage: Stage, result: StageFlowResult) => {
      audioEngine.stop()
      markPracticedToday()
      saveSkillScore(skillKeyOf(stage), stageSkillScore(result.flow))
      let next = settings
      if (stageClearedBy(result.flow)) {
        markStageCleared(stage.id, result.bpm)
        const nextStage = STAGES[stage.number]
        if (nextStage) {
          next = { ...next, selectedStageId: nextStage.id }
        }
      }
      let tempoChange = 0
      if (settings.autoTempo) {
        const tempo = tempoAfterStage(settings.bpm, result.flow)
        tempoChange = tempo.change
        next = { ...next, bpm: tempo.bpm }
      }
      if (next !== settings) {
        setSettings(next)
        saveSettings(next)
      }
      setScreen({ kind: 'stage-summary', stage, result, tempoChange })
    },
    [settings],
  )

  const startDictation = (stage: Stage) => {
    attemptRef.current += 1
    setScreen({ kind: 'dictation', attempt: attemptRef.current, stage, seed: Math.floor(Math.random() * 1_000_000) })
  }

  const startFromSetup = () => {
    if (settings.exercise === 'dictation') {
      startDictation(selectedStage(settings))
      return
    }
    if (settings.target === 'stages') {
      void startStageFlow(selectedStage(settings))
      return
    }
    const list = listForTarget(settings)
    const nextQueue: Queue = {
      kind: 'patterns',
      patterns: list.patterns,
      patternStages: list.patterns.map(() => null),
      labels: [],
      index: selectedIndex(list, settings),
      outcomes: [],
      quick: null,
      list,
    }
    setQueue(nextQueue)
    void play(nextQueue.patterns[nextQueue.index], settings.bpm)
  }

  const startQuick = () => {
    const nextQueue = quickQueue(settings)
    setQueue(nextQueue)
    void play(nextQueue.patterns[0], settings.bpm)
  }

  const currentPattern = queue ? queue.patterns[queue.index] : contentPatterns[0]

  const finish = useCallback(
    (result: SessionResult) => {
      audioEngine.stop()
      if (!queue) {
        return
      }
      const pattern = queue.patterns[queue.index]
      const stars = starsFor(result.metrics)
      let record: RecordUpdate | null = null
      if (queue.kind === 'patterns') {
        record = saveAttempt(pattern.id, settings.mode, stars, result.bpm)
      }
      markPracticedToday()
      const patternStage = queue.patternStages[queue.index]
      const score = outcomeScore(result.passed, result.repetitionsPlayed)
      const skillKey = patternStage ? skillKeyOf(patternStage) : hasStrum(pattern) ? `strum:${pattern.id}` : null
      if (skillKey) {
        saveSkillScore(skillKey, score)
      }
      let quick = queue.quick
      if (quick && skillKey) {
        const history = [...quick.history, { stageId: patternStage?.id ?? pattern.id, patternId: pattern.id, skillKey, score }]
        quick = { ...quick, activeMs: quick.activeMs + result.repetitionsPlayed * result.patternMs, history }
      }
      let tempoChange = 0
      if (settings.autoTempo) {
        const tempo = tempoAfterLoop(settings.bpm, result.passed ? result.repetitionsPlayed : null)
        tempoChange = tempo.change
        if (tempo.change !== 0) {
          const next = { ...settings, bpm: tempo.bpm }
          setSettings(next)
          saveSettings(next)
        }
      }
      const outcomes = [...queue.outcomes]
      outcomes[queue.index] = {
        pattern,
        passed: result.passed,
        repetitionsPlayed: result.repetitionsPlayed,
        stars,
        bpm: result.bpm,
        label: queue.labels[queue.index],
      }
      setQueue({ ...queue, outcomes, quick })
      setScreen({ kind: 'result', result, stars, record, tempoChange, pattern: screen.kind === 'session' ? screen.pattern : pattern })
    },
    [queue, settings, screen],
  )

  const cancel = useCallback((reason?: string) => {
    audioEngine.stop()
    setNotice(reason ?? null)
    setScreen({ kind: 'setup' })
  }, [])

  const calibrate = async () => {
    if (!(await unlockAudio())) {
      return
    }
    attemptRef.current += 1
    setScreen({ kind: 'calibration', attempt: attemptRef.current, audioStart: audioEngine.playSession(calibrationSounds()) })
  }

  if (screen.kind === 'calibration') {
    return (
      <CalibrationScreen
        key={screen.attempt}
        audioStart={screen.audioStart}
        currentOffsetMs={settings.latencyOffsetMs}
        onSave={(offsetMs) => {
          audioEngine.stop()
          changeSettings({ ...settings, latencyOffsetMs: offsetMs })
          setScreen({ kind: 'setup' })
        }}
        onRetry={calibrate}
        onCancel={() => cancel()}
      />
    )
  }

  if (screen.kind === 'dictation') {
    return (
      <DictationScreen
        key={screen.attempt}
        stage={screen.stage}
        kind={settings.dictationKind}
        bpm={settings.bpm}
        seed={screen.seed}
        onFinish={(correct, total) => {
          markPracticedToday()
          saveSkillScore(`dictation:${skillKeyOf(screen.stage)}`, correct / total)
        }}
        onRetry={() => startDictation(screen.stage)}
        onCancel={() => setScreen({ kind: 'setup' })}
      />
    )
  }

  if (screen.kind === 'stage-flow') {
    return (
      <StageFlowScreen
        key={screen.attempt}
        stage={screen.stage}
        units={screen.units}
        settings={settings}
        plan={screen.plan}
        audioStart={screen.audioStart}
        scheduledSlots={screen.plan.slotsForUnit(0, true).length}
        onFinish={(result) => finishStageFlow(screen.stage, result)}
        onCancel={cancel}
      />
    )
  }

  if (screen.kind === 'stage-summary') {
    const { stage, result, tempoChange } = screen
    const cleared = stageClearedBy(result.flow)
    const nextStage = STAGES[stage.number]
    const outcomes: PatternOutcome[] = result.units.map((unit, index) => ({
      pattern: unit,
      passed: !result.flow.skipped[index],
      repetitionsPlayed: result.flow.attempts[index],
      stars: result.lastMetrics[index] ? starsFor(result.lastMetrics[index]) : 0,
      bpm: result.bpm,
      label: result.flow.attempts[index] >= REVIEW_BAR_ATTEMPTS ? '다시 볼 마디' : undefined,
    }))
    const tempoNote = tempoChange === 0 ? '' : ` 다음 BPM ${settings.bpm} (${tempoChange > 0 ? '+' : ''}${tempoChange})`
    return (
      <SummaryScreen
        heading={cleared ? '단계 통과!' : '단계를 다시 해볼까요?'}
        title={`${stage.number}. ${stage.title}`}
        extra={`두 마디마다 평균 ${(result.flow.attempts.reduce((sum, count) => sum + count, 0) / result.units.length).toFixed(1)}번 쳤어요.${tempoNote}`}
        outcomes={outcomes}
        actions={[
          ...(cleared && nextStage
            ? [{ label: '다음 단계 →', primary: true, onClick: () => void startStageFlow(nextStage) }]
            : []),
          { label: '이 단계 다시', primary: !(cleared && nextStage), onClick: () => void startStageFlow(stage) },
          { label: '목록으로', onClick: () => setScreen({ kind: 'setup' }) },
        ]}
      />
    )
  }

  if (screen.kind === 'session' && queue) {
    return (
      <SessionScreen
        key={screen.attempt}
        pattern={screen.pattern}
        settings={settings}
        plan={screen.plan}
        audioStart={screen.audioStart}
        scheduledRepetitions={INITIAL_SCHEDULED_REPETITIONS}
        progressLabel={
          queue.kind === 'quick'
            ? `${queue.labels[queue.index]} · ${Math.floor((queue.quick?.activeMs ?? 0) / MILLISECONDS_PER_MINUTE)}분`
            : currentPattern.title
        }
        onFinish={finish}
        onCancel={cancel}
      />
    )
  }

  if (screen.kind === 'result' && queue) {
    const quick = queue.quick
    let onNext: (() => void) | null = null
    let nextLabel = ''
    if (quick) {
      if (quickTimeUp(quick.activeMs, quick.targetMs)) {
        onNext = () => setScreen({ kind: 'summary' })
        nextLabel = '오늘 연습 요약'
      } else {
        onNext = () => {
          const nextQueue = withNextQuickItem(queue, settings)
          setQueue(nextQueue)
          void play(nextQueue.patterns[nextQueue.index], settings.bpm)
        }
        nextLabel = '다음 문제 →'
      }
    } else if (queue.index + 1 < queue.patterns.length) {
      onNext = () => {
        const nextQueue = { ...queue, index: queue.index + 1 }
        setQueue(nextQueue)
        if (queue.list) {
          changeSettings({ ...settings, [queue.list.selectedKey]: nextQueue.patterns[nextQueue.index].id })
        }
        void play(nextQueue.patterns[nextQueue.index], settings.bpm)
      }
      nextLabel = '다음 패턴 →'
    }
    return (
      <ResultScreen
        pattern={screen.pattern}
        result={screen.result}
        stars={screen.stars}
        record={screen.record}
        tempoChange={screen.tempoChange}
        nextBpm={settings.bpm}
        autoTempo={settings.autoTempo}
        onRetry={() => void play(currentPattern, settings.bpm)}
        onBack={() => (quick ? setScreen({ kind: 'summary' }) : setScreen({ kind: 'setup' }))}
        backLabel={quick ? '연습 끝내기' : '목록으로'}
        onNext={onNext}
        nextLabel={nextLabel}
      />
    )
  }

  if (screen.kind === 'summary' && queue?.quick) {
    const quick = queue.quick
    const minutes = Math.max(1, Math.round(quick.activeMs / MILLISECONDS_PER_MINUTE))
    return (
      <SummaryScreen
        heading="오늘 연습 끝!"
        title={`빠른 연습 · 약 ${minutes}분`}
        extra={`연속 ${currentStreak()}일째 연습했어요.`}
        outcomes={queue.outcomes.filter(Boolean)}
        actions={[
          {
            label: `${EXTEND_MINUTES}분 더`,
            primary: true,
            onClick: () => {
              const extended = withNextQuickItem(
                { ...queue, quick: { ...quick, targetMs: Math.max(quick.targetMs ?? 0, quick.activeMs) + EXTEND_MINUTES * MILLISECONDS_PER_MINUTE } },
                settings,
              )
              setQueue(extended)
              void play(extended.patterns[extended.index], settings.bpm)
            },
          },
          { label: '끝내기', onClick: () => setScreen({ kind: 'setup' }) },
        ]}
      />
    )
  }

  return (
    <SetupScreen
      settings={settings}
      notice={notice}
      onChange={changeSettings}
      onStart={startFromSetup}
      onQuickStart={startQuick}
      onCalibrate={calibrate}
      tab={setupTab}
      onTabChange={setSetupTab}
    />
  )
}
