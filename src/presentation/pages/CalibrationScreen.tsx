import { useEffect, useState } from 'react'
import { CALIBRATION_BEATS, CALIBRATION_BEAT_MS, CALIBRATION_BPM } from '../../application/calibration-session.ts'
import { DEFAULT_CALIBRATION_OPTIONS, measureLatencyOffset } from '../../domain/practice/calibration.ts'
import type { LatencyMeasurement } from '../../domain/practice/calibration.ts'
import { useAudioClock } from '../hooks/use-audio-clock.ts'

const BEAT_MS = CALIBRATION_BEAT_MS
const MAXIMUM_TRUSTED_SPREAD_MS = 40

type Props = {
  audioStart: number
  currentOffsetMs: number
  onSave: (offsetMs: number) => void
  onRetry: () => void
  onCancel: () => void
}

export default function CalibrationScreen({ audioStart, currentOffsetMs, onSave, onRetry, onCancel }: Props) {
  const { nowMs, originMs } = useAudioClock(audioStart, BEAT_MS * (DEFAULT_CALIBRATION_OPTIONS.warmUpBeats - 0.5))
  const [tapTimes, setTapTimes] = useState<number[]>([])
  const elapsedMs = nowMs - originMs
  const beat = Math.min(CALIBRATION_BEATS, Math.max(0, Math.floor(elapsedMs / BEAT_MS) + 1))
  const finished = elapsedMs > CALIBRATION_BEATS * BEAT_MS + 300
  const [measurement, setMeasurement] = useState<LatencyMeasurement | null | undefined>(undefined)

  if (finished && measurement === undefined) {
    const beatTimes = Array.from({ length: CALIBRATION_BEATS }, (_, index) => originMs + index * BEAT_MS)
    setMeasurement(measureLatencyOffset(beatTimes, tapTimes))
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      event.preventDefault()
      setTapTimes((previous) => [...previous, event.timeStamp])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  if (measurement !== undefined) {
    const trusted = measurement !== null && measurement.spreadMs <= MAXIMUM_TRUSTED_SPREAD_MS
    return (
      <div className="result">
        <h2 className="result-title">지연 보정</h2>
        {measurement === null ? (
          <p>탭이 부족해서 잴 수 없었어요. 소리에 맞춰 끝까지 탭해 주세요.</p>
        ) : (
          <>
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-value">
                  {measurement.offsetMs > 0 ? '+' : ''}
                  {measurement.offsetMs}ms
                </div>
                <div className="metric-label">측정한 보정값</div>
              </div>
              <div className="metric">
                <div className="metric-value">±{measurement.spreadMs}ms</div>
                <div className="metric-label">탭 흔들림</div>
              </div>
              <div className="metric">
                <div className="metric-value">{measurement.tapCount}</div>
                <div className="metric-label">사용한 탭</div>
              </div>
            </div>
            <p className="muted">
              지금 보정값은 {currentOffsetMs > 0 ? '+' : ''}
              {currentOffsetMs}ms 예요.
              {measurement.offsetMs > 0 ? ' 소리보다 늦게 기록되는 만큼 판정을 뒤로 미뤄요.' : ' 소리보다 일찍 기록되는 만큼 판정을 앞으로 당겨요.'}
            </p>
            {!trusted && <p className="notice">탭 간격이 많이 흔들렸어요. 한 번 더 재는 걸 추천해요.</p>}
          </>
        )}
        <div className="button-row">
          {measurement !== null && (
            <button type="button" className="primary-button" onClick={() => onSave(measurement.offsetMs)}>
              이 값으로 저장
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onRetry}>
            다시 재기
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="session">
      <header className="session-header">
        <button type="button" className="link-button" onClick={onCancel}>
          ← 그만하기
        </button>
        <span className="muted">지연 보정 · {CALIBRATION_BPM} BPM</span>
      </header>
      <div className="session-status">
        {beat <= DEFAULT_CALIBRATION_OPTIONS.warmUpBeats ? '소리에 맞춰 탭하세요' : '계속 탭하세요'}
      </div>
      <p className="calibration-progress muted">
        {beat} / {CALIBRATION_BEATS}
      </p>
      <p className="muted small calibration-help">
        틱 소리가 들리는 순간에 맞춰 탭하세요. 처음 {DEFAULT_CALIBRATION_OPTIONS.warmUpBeats}번은 몸풀기라 계산에서 빼요. 화면을 보지 말고 소리만 들으세요.
      </p>
      <div
        className="tap-area"
        role="button"
        tabIndex={-1}
        onPointerDown={(event) => {
          event.preventDefault()
          const timeStamp = event.nativeEvent.timeStamp
          setTapTimes((previous) => [...previous, timeStamp])
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        탭
        <span className="tap-hint">탭 {tapTimes.length}번</span>
      </div>
    </div>
  )
}
