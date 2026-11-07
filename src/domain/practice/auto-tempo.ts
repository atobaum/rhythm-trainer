export type TempoPolicy = {
  stepBpm: number
  minimumBpm: number
  maximumBpm: number
}

export const DEFAULT_TEMPO_POLICY: TempoPolicy = {
  stepBpm: 5,
  minimumBpm: 40,
  maximumBpm: 200,
}
