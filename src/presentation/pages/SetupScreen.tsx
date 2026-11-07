import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { GuideMode, PracticeMode } from '../../application/practice-types.ts'
import { STAGES, currentStageIndex } from '../../domain/curriculum/stages.ts'
import type { QuickStrategy } from '../../domain/curriculum/quick-curation.ts'
import type { DictationKind } from './DictationScreen.tsx'
import { currentStreak } from '../learning-store.ts'
import { patternListFor, selectedIndex } from '../pattern-lists.ts'
import { MAXIMUM_POLYRHYTHM_DIVISIONS } from '../../domain/rhythm/polyrhythm.ts'
import ScoreView from '../components/ScoreView.tsx'
import { loadRecord } from '../practice-records.ts'
import type { StoredSettings } from '../practice-settings.ts'
import { loadStageProgress } from '../stage-progress.ts'

export type SetupTab = 'practice' | 'settings'

type Props = {
  settings: StoredSettings
  notice: string | null
  tab: SetupTab
  onTabChange: (tab: SetupTab) => void
  onChange: (settings: StoredSettings) => void
  onStart: () => void
  onQuickStart: () => void
  onCalibrate: () => void
  sheetOpen: boolean
  onSheetChange: (open: boolean) => void
}

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="choice">
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className={option.value === value ? 'choice-item choice-selected' : 'choice-item'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="option-row">
      <span className="option-label">{label}</span>
      <div className="option-control">{children}</div>
    </div>
  )
}

function RecordBadge({ patternId, mode }: { patternId: string; mode: PracticeMode }) {
  const record = loadRecord(patternId, mode)
  if (record === null) {
    return null
  }
  return (
    <span className="record-badge">
      <span className="stars">{'★'.repeat(record.bestStars)}{'☆'.repeat(5 - record.bestStars)}</span>
      {record.bestCleanBpm !== null && <span className="muted"> {record.bestCleanBpm} BPM</span>}
    </span>
  )
}

function QuickCard({
  settings,
  currentStage,
  onStart,
}: {
  settings: StoredSettings
  currentStage: (typeof STAGES)[number]
  onStart: () => void
}) {
  const streak = currentStreak()
  const minutes = settings.quickMinutes
  return (
    <section className="quick-card">
      <div className="quick-text">
        <strong>빠른 연습</strong>
        <span className="muted small">
          {minutes > 0 ? `${minutes}분 · 약 ${Math.max(2, Math.round(minutes * 1.5))}문제` : '시간 제한 없음'} · 지금 {currentStage.number}. {currentStage.title}
          {streak > 0 ? ` · 연속 ${streak}일` : ''}
        </span>
      </div>
      <button type="button" className="start-button quick-start" onClick={onStart}>
        시작
      </button>
    </section>
  )
}

const MODE_LABELS: Record<PracticeMode, string> = { reading: '보고 치기', imitation: '듣고 따라 치기' }
const GUIDE_LABELS: Record<GuideMode, string> = { 'every-beat': '매 박', 'first-beat': '첫 박만', gap: '1마디씩 끄기', none: '기준음 끔' }

function optionSummary(settings: StoredSettings): string {
  const tempo = `${settings.bpm} BPM${settings.autoTempo ? ' 자동' : ''}`
  if (settings.exercise === 'dictation') {
    return ['듣고 맞히기', settings.dictationKind === 'choice' ? '악보 고르기' : '악보 완성하기', tempo].join(' · ')
  }
  const parts = [MODE_LABELS[settings.mode], tempo, GUIDE_LABELS[settings.guide]]
  if (settings.target === 'strum') {
    parts.push(settings.strumInput === 'split' ? '↓↑ 나눠 탭' : '방향 없이 탭')
  }
  if (settings.target === 'two-hand' || settings.target === 'polyrhythm') {
    parts.push({ both: '양손', left: '왼손만', right: '오른손만' }[settings.handFocus])
  }
  if (settings.target === 'polyrhythm') {
    parts.push(`${settings.polyrhythm[0]}:${settings.polyrhythm[1]}`)
  }
  return parts.join(' · ')
}

export default function SetupScreen({
  settings,
  notice,
  tab,
  onTabChange,
  onChange,
  onStart,
  onQuickStart,
  onCalibrate,
  sheetOpen,
  onSheetChange,
}: Props) {
  const update = <K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) => onChange({ ...settings, [key]: value })
  const clampBpm = (bpm: number) => Math.min(200, Math.max(40, Math.round(bpm)))
  const progress = loadStageProgress()
  const clearedCount = STAGES.filter((stage) => progress[stage.id]).length
  const currentIndex = currentStageIndex(new Set(Object.keys(progress)))
  const selectedStage = STAGES.find((stage) => stage.id === settings.selectedStageId) ?? STAGES[currentIndex]
  const stageListRef = useRef<HTMLDivElement>(null)
  const list = settings.target === 'stages' ? null : patternListFor(settings.target, settings)

  useEffect(() => {
    const list = stageListRef.current
    const card = list?.querySelector<HTMLElement>(`[data-stage-id="${selectedStage.id}"]`)
    if (list && card) {
      list.scrollTop = card.offsetTop - list.offsetTop - list.clientHeight / 2 + card.clientHeight / 2
    }
  }, [settings.target, tab, selectedStage.id])

  return (
    <div className={tab === 'practice' ? 'setup setup-practice' : 'setup'}>
      <header className="setup-header">
        <h1 className="app-title">Rhythm Lab</h1>
        <nav className="tabs">
          <button type="button" className={tab === 'practice' ? 'tab tab-selected' : 'tab'} onClick={() => onTabChange('practice')}>
            연습
          </button>
          <button type="button" className={tab === 'settings' ? 'tab tab-selected' : 'tab'} onClick={() => onTabChange('settings')}>
            설정
          </button>
        </nav>
      </header>
      {notice && <p className="notice">{notice}</p>}

      {tab === 'practice' ? (
        <>
          <QuickCard settings={settings} currentStage={STAGES[currentIndex]} onStart={onQuickStart} />
          <div className="setup-scroll">
            {settings.target === 'stages' && (
              <div className="stage-list" ref={stageListRef}>
                {STAGES.map((stage, index) => (
                  <Fragment key={stage.id}>
                    {stage.section !== STAGES[index - 1]?.section && <h3 className="stage-section">{stage.section}</h3>}
                    <button
                      type="button"
                      data-stage-id={stage.id}
                      className={[
                        'stage-card',
                        stage.id === selectedStage.id ? 'stage-selected' : '',
                        index > currentIndex ? 'stage-ahead' : '',
                      ].join(' ')}
                      onClick={() => update('selectedStageId', stage.id)}
                    >
                      <span className={progress[stage.id] ? 'stage-number stage-cleared' : 'stage-number'}>{stage.number}</span>
                      <span className="stage-text">
                        <span className="stage-title">{stage.title}</span>
                        <span className="muted small">
                          {progress[stage.id] ? `✓ 통과 · ${progress[stage.id].bestBpm} BPM` : stage.subtitle}
                        </span>
                      </span>
                      <span className="goal-icon">
                        <ScoreView pattern={stage.icon} minimal />
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
            )}
            {list && (
              <div className="pattern-list">
                {list.patterns.map((pattern) => (
                  <button
                    type="button"
                    key={pattern.id}
                    className={pattern.id === list.patterns[selectedIndex(list, settings)].id ? 'pattern-card pattern-selected' : 'pattern-card'}
                    onClick={() => update(list.selectedKey, pattern.id)}
                  >
                    <span className="pattern-card-title">
                      {pattern.title}
                      <RecordBadge patternId={pattern.id} mode={settings.mode} />
                    </span>
                    <ScoreView pattern={pattern} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <footer className="setup-bar">
            {settings.exercise === 'tap' && <div className="target-switch">
              <Choice<StoredSettings['target']>
                value={settings.target}
                onChange={(target) => update('target', target)}
                options={[
                  { value: 'stages', label: `단계 (${clearedCount}/${STAGES.length})` },
                  { value: 'patterns', label: '고정 패턴' },
                  { value: 'strum', label: '기타 스트로크' },
                  { value: 'two-hand', label: '양손' },
                  { value: 'polyrhythm', label: '폴리리듬' },
                ]}
              />
            </div>}
            <button type="button" className="option-summary" onClick={() => onSheetChange(true)}>
              <span>{optionSummary(settings)}</span>
              <span aria-hidden="true">옵션 ▴</span>
            </button>
            <button type="button" className="start-button" onClick={onStart}>
              {settings.target !== 'stages'
                ? '시작'
                : `${selectedStage.number}. ${selectedStage.title} ${settings.exercise === 'dictation' ? '청음 ' : ''}시작`}
            </button>
          </footer>
          {sheetOpen && (
            <div className="sheet-backdrop" onClick={() => onSheetChange(false)}>
              <section className="sheet" role="dialog" aria-label="연습 옵션" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                  <strong>연습 옵션</strong>
                  <button type="button" className="link-button" onClick={() => onSheetChange(false)}>
                    닫기
                  </button>
                </div>
                <section className="options">
                  <OptionRow label="방식">
                    <Choice<PracticeMode | 'dictation'>
                      value={settings.exercise === 'dictation' ? 'dictation' : settings.mode}
                      onChange={(choice) =>
                        onChange(
                          choice === 'dictation'
                            ? { ...settings, exercise: 'dictation', target: 'stages' }
                            : { ...settings, exercise: 'tap', mode: choice },
                        )
                      }
                      options={[
                        { value: 'reading', label: '보고 치기' },
                        { value: 'imitation', label: '듣고 따라 치기' },
                        { value: 'dictation', label: '듣고 맞히기' },
                      ]}
                    />
                  </OptionRow>
                  {settings.exercise === 'dictation' && (
                    <OptionRow label="문제">
                      <Choice<DictationKind>
                        value={settings.dictationKind}
                        onChange={(kind) => update('dictationKind', kind)}
                        options={[
                          { value: 'choice', label: '악보 고르기' },
                          { value: 'compose', label: '악보 완성하기' },
                        ]}
                      />
                    </OptionRow>
                  )}
                  {settings.exercise === 'tap' && settings.mode === 'imitation' && (
                    <label className="check-row option-indent">
                      <input
                        type="checkbox"
                        checked={settings.hideScoreWhileImitating}
                        onChange={(event) => update('hideScoreWhileImitating', event.target.checked)}
                      />
                      악보 숨기고 기억해서 치기
                    </label>
                  )}
                  <OptionRow label="템포">
                    <div className="bpm-row">
                      <button type="button" className="secondary-button" onClick={() => update('bpm', clampBpm(settings.bpm - 5))}>
                        −5
                      </button>
                      <input
                        className="bpm-input"
                        type="number"
                        inputMode="numeric"
                        min={40}
                        max={200}
                        value={settings.bpm}
                        onChange={(event) => update('bpm', clampBpm(Number(event.target.value) || 40))}
                      />
                      <button type="button" className="secondary-button" onClick={() => update('bpm', clampBpm(settings.bpm + 5))}>
                        +5
                      </button>
                      <label className="check-row">
                        <input type="checkbox" checked={settings.autoTempo} onChange={(event) => update('autoTempo', event.target.checked)} />
                        자동
                      </label>
                    </div>
                  </OptionRow>
                  {settings.exercise === 'tap' && (
                  <OptionRow label="기준음">
                    <Choice<GuideMode>
                      value={settings.guide}
                      onChange={(guide) => update('guide', guide)}
                      options={[
                        { value: 'every-beat', label: '매 박' },
                        { value: 'first-beat', label: '첫 박만' },
                        { value: 'gap', label: '1마디씩 끄기' },
                        { value: 'none', label: '끔' },
                      ]}
                    />
                  </OptionRow>
                  )}
                  {settings.exercise === 'tap' && settings.target === 'stages' && (
                    <OptionRow label="연습 중">
                      <div className="check-column">
                        <label className="check-row">
                          <input type="checkbox" checked={settings.tempoRamp} onChange={(event) => update('tempoRamp', event.target.checked)} />
                          템포 올리기
                        </label>
                        <label className="check-row">
                          <input type="checkbox" checked={settings.guideFade} onChange={(event) => update('guideFade', event.target.checked)} />
                          기준음 줄이기
                        </label>
                        <span className="muted small">두 칸 연속 깔끔하면 +5 BPM, 기준음 한 단계 줄임</span>
                      </div>
                    </OptionRow>
                  )}
                </section>
                {['strum', 'two-hand', 'polyrhythm'].includes(settings.target) && (
                  <section className="options">
                {settings.target === 'strum' && (
                  <OptionRow label="입력">
                    <Choice<StoredSettings['strumInput']>
                      value={settings.strumInput}
                      onChange={(input) => update('strumInput', input)}
                      options={[
                        { value: 'split', label: '왼쪽 ↓ · 오른쪽 ↑' },
                        { value: 'tap', label: '방향 없이 탭' },
                      ]}
                    />
                  </OptionRow>
                )}
                {(settings.target === 'two-hand' || settings.target === 'polyrhythm') && (
                  <OptionRow label="손">
                    <Choice<StoredSettings['handFocus']>
                      value={settings.handFocus}
                      onChange={(focus) => update('handFocus', focus)}
                      options={[
                        { value: 'both', label: '양손' },
                        { value: 'left', label: '왼손만' },
                        { value: 'right', label: '오른손만' },
                      ]}
                    />
                  </OptionRow>
                )}
                {settings.target === 'polyrhythm' && (
                  <OptionRow label="비율">
                    <div className="bpm-row">
                      {([0, 1] as const).map((side) => (
                        <Fragment key={side}>
                          {side === 1 && <span>:</span>}
                          <input
                            className="bpm-input"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={MAXIMUM_POLYRHYTHM_DIVISIONS}
                            value={settings.polyrhythm[side]}
                            onChange={(event) => {
                              const value = Math.min(MAXIMUM_POLYRHYTHM_DIVISIONS, Math.max(1, Math.round(Number(event.target.value) || 1)))
                              const ratio: [number, number] = side === 0 ? [value, settings.polyrhythm[1]] : [settings.polyrhythm[0], value]
                              onChange({ ...settings, polyrhythm: ratio, polyrhythmPatternId: `polyrhythm-${ratio[0]}-${ratio[1]}` })
                            }}
                          />
                        </Fragment>
                      ))}
                      <span className="muted small">왼손 : 오른손</span>
                    </div>
                  </OptionRow>
                )}
                  </section>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <section>
          <h2 className="section-title">빠른 연습</h2>
          <section className="options">
            <OptionRow label="연습 시간">
              <Choice<number>
                value={settings.quickMinutes}
                onChange={(minutes) => update('quickMinutes', minutes)}
                options={[
                  { value: 3, label: '3분' },
                  { value: 5, label: '5분' },
                  { value: 10, label: '10분' },
                  { value: 15, label: '15분' },
                  { value: 0, label: '제한 없음' },
                ]}
              />
            </OptionRow>
            <OptionRow label="문제 구성">
              <Choice<QuickStrategy>
                value={settings.quickStrategy}
                onChange={(strategy) => update('quickStrategy', strategy)}
                options={[
                  { value: 'auto', label: '자동' },
                  { value: 'review-first', label: '복습 우선' },
                  { value: 'progress-first', label: '진도 우선' },
                ]}
              />
            </OptionRow>
            <label className="check-row">
              <input type="checkbox" checked={settings.quickIncludeStrum} onChange={(event) => update('quickIncludeStrum', event.target.checked)} />
              기타 스트로크 문제도 섞기
            </label>
          </section>
          <p className="muted small">
            시간은 패턴을 치는 동안만 세요. 시간이 되면 치던 패턴을 마치고 요약을 보여줘요. 문제는 진도, 약한 음형, 처음 보는 패턴, 도전 문제를 섞어서 그때그때 골라요.
          </p>
          <h2 className="section-title">탭 소리</h2>
          <label className="check-row">
            <input type="checkbox" checked={settings.tapSound} onChange={(event) => update('tapSound', event.target.checked)} />
            누를 때마다 소리 내기
          </label>
          <p className="muted small">기기에 따라 소리가 조금 늦게 들릴 수 있어요. 늦게 들려서 헷갈리면 끄세요.</p>
          <h2 className="section-title">지연 보정</h2>
          <div className="calibration-row">
            <span>
              {settings.latencyOffsetMs > 0 ? '+' : ''}
              {settings.latencyOffsetMs}ms
            </span>
            <button type="button" className="primary-button" onClick={onCalibrate}>
              탭으로 보정
            </button>
            {settings.latencyOffsetMs !== 0 && (
              <button type="button" className="link-button" onClick={() => update('latencyOffsetMs', 0)}>
                초기화
              </button>
            )}
          </div>
          <p className="muted small">
            기기마다 소리가 나는 시점과 터치가 기록되는 시점이 달라요. 틱 소리에 맞춰 20번 탭하면 그 차이를 재서 판정에 반영해요. 이어폰을 바꾸면 다시 재세요. 블루투스 이어폰은 지연이 커요.
          </p>
          <p className="muted small">iPhone 은 무음 모드에서 소리가 안 날 수 있어요.</p>
        </section>
      )}
    </div>
  )
}
