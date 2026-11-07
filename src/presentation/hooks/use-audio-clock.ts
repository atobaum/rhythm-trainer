import { useEffect, useState } from 'react'
import { audioEngine } from '../../infrastructure/audio/audio-engine.ts'

const SAMPLING_START_MS = 300

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

export type AudioClock = {
  nowMs: number
  originMs: number
}

// 오디오 시계 변환값은 호출마다 수십 ms 흔들려서, 채점이 시작되기 전까지 모은 값의 중앙값으로 고정한다.
export function useAudioClock(audioStart: number, freezeAtElapsedMs: number): AudioClock {
  const [clock, setClock] = useState<AudioClock>(() => ({
    nowMs: performance.now(),
    originMs: audioEngine.audioTimeToPerformanceMs(audioStart),
  }))

  useEffect(() => {
    const samples: number[] = []
    let frozenOrigin: number | null = null
    let frame = 0
    const loop = () => {
      const now = performance.now()
      let origin = frozenOrigin
      if (origin === null) {
        const current = audioEngine.audioTimeToPerformanceMs(audioStart)
        if (now - current >= SAMPLING_START_MS) {
          samples.push(current)
        }
        if (now - current >= freezeAtElapsedMs && samples.length > 0) {
          frozenOrigin = median(samples)
        }
        origin = frozenOrigin ?? current
      }
      setClock({ nowMs: now, originMs: origin })
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [audioStart, freezeAtElapsedMs])

  return clock
}
