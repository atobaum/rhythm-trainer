export type PracticeMode = 'reading' | 'imitation'
export type GuideMode = 'every-beat' | 'first-beat' | 'gap' | 'none'

export type SoundKind = 'accent' | 'beat' | 'note' | 'note-high' | 'strum-down' | 'strum-up' | 'tap'

export type ScheduledSound = {
  timeMs: number
  kind: SoundKind
  stressed?: boolean
}
