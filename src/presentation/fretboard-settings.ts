import { STRING_NUMBERS, clampFret } from '../domain/fretboard/fretboard.ts'
import type { FretRange } from '../domain/fretboard/fretboard.ts'
import type { FretboardMode } from '../domain/fretboard/questions.ts'
import { readStored, writeStored } from './local-store.ts'

const STORAGE_KEY = 'rhythm-lab.fretboard-settings.v1'

export const QUESTION_COUNTS = [10, 20, 40] as const
export type QuestionCount = (typeof QUESTION_COUNTS)[number]

export type FretboardSettings = {
  mode: FretboardMode
  strings: number[]
  fromFret: number
  toFret: number
  questionCount: QuestionCount
  soundEnabled: boolean
}

export const DEFAULT_FRETBOARD_SETTINGS: FretboardSettings = {
  mode: 'find-the-position',
  strings: [...STRING_NUMBERS],
  fromFret: 0,
  toFret: 12,
  questionCount: 20,
  soundEnabled: true,
}

export function normalizeFretboardSettings(stored: Partial<FretboardSettings>): FretboardSettings {
  const defaults = DEFAULT_FRETBOARD_SETTINGS
  const mode = stored.mode === 'name-the-note' || stored.mode === 'find-the-position' ? stored.mode : defaults.mode
  const strings = Array.isArray(stored.strings)
    ? STRING_NUMBERS.filter((stringNumber) => stored.strings?.includes(stringNumber))
    : defaults.strings
  const fromFret = typeof stored.fromFret === 'number' ? clampFret(stored.fromFret) : defaults.fromFret
  const toFret = typeof stored.toFret === 'number' ? clampFret(stored.toFret) : defaults.toFret
  const questionCount = QUESTION_COUNTS.find((count) => count === stored.questionCount) ?? defaults.questionCount
  const soundEnabled = typeof stored.soundEnabled === 'boolean' ? stored.soundEnabled : defaults.soundEnabled
  return fromFret <= toFret
    ? { mode, strings, fromFret, toFret, questionCount, soundEnabled }
    : { mode, strings, fromFret: defaults.fromFret, toFret: defaults.toFret, questionCount, soundEnabled }
}

export function loadFretboardSettings(): FretboardSettings {
  return normalizeFretboardSettings(readStored<Partial<FretboardSettings>>(STORAGE_KEY, {}))
}

export function saveFretboardSettings(settings: FretboardSettings): void {
  writeStored(STORAGE_KEY, settings)
}

export function rangeOf(settings: FretboardSettings): FretRange {
  return { strings: settings.strings, fromFret: settings.fromFret, toFret: settings.toFret }
}
