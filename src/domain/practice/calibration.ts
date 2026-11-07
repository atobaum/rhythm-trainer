export type LatencyMeasurement = {
  offsetMs: number
  tapCount: number
  spreadMs: number
}

export type CalibrationOptions = {
  warmUpBeats: number
  maximumDistanceMs: number
  minimumTaps: number
}

export const DEFAULT_CALIBRATION_OPTIONS: CalibrationOptions = {
  warmUpBeats: 4,
  maximumDistanceMs: 250,
  minimumTaps: 8,
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function measureLatencyOffset(
  beatTimesMs: number[],
  tapTimesMs: number[],
  options: CalibrationOptions = DEFAULT_CALIBRATION_OPTIONS,
): LatencyMeasurement | null {
  const countedBeats = beatTimesMs.slice(options.warmUpBeats)
  const errors: number[] = []
  for (const beat of countedBeats) {
    let closest: number | null = null
    for (const tap of tapTimesMs) {
      const error = tap - beat
      if (Math.abs(error) <= options.maximumDistanceMs && (closest === null || Math.abs(error) < Math.abs(closest))) {
        closest = error
      }
    }
    if (closest !== null) {
      errors.push(closest)
    }
  }
  if (errors.length < options.minimumTaps) {
    return null
  }
  const offsetMs = Math.round(median(errors))
  const spreadMs = Math.round(median(errors.map((error) => Math.abs(error - offsetMs))))
  return { offsetMs, tapCount: errors.length, spreadMs }
}
