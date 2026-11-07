import type { ScheduledSound } from './practice-types.ts'

export const CALIBRATION_BPM = 90
export const CALIBRATION_BEATS = 20
export const CALIBRATION_BEAT_MS = 60000 / CALIBRATION_BPM

export function calibrationSounds(): ScheduledSound[] {
  return Array.from({ length: CALIBRATION_BEATS }, (_, beat) => ({
    timeMs: beat * CALIBRATION_BEAT_MS,
    kind: beat % 4 === 0 ? 'accent' : 'beat',
  }))
}
