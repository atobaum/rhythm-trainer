import {
  addFractions,
  compareFractions,
  createFraction,
  formatFraction,
  isNormalizedFraction,
  parseFraction,
  subtractFractions,
} from './fraction.ts'
import type { Fraction } from './fraction.ts'

export type TimeSignature = {
  numerator: number
  denominator: number
}

export type Tuplet = {
  actual: number
  normal: number
}

export type StrumDirection = 'down' | 'up'

export type RhythmEvent = {
  id: string
  onset: Fraction
  duration: Fraction
  kind: 'note' | 'rest'
  notation: {
    dots: number
    tuplet?: Tuplet
    tupletGroup?: string
    tieGroupId?: string
  }
  articulation?: {
    accent?: boolean
    velocity?: number
  }
  strum?: {
    direction: StrumDirection
    motion: 'sound' | 'ghost'
  }
}

export type RhythmTrack = {
  id: string
  role: 'single' | 'left' | 'right'
  instrument: 'tap' | 'percussion' | 'guitar'
  events: RhythmEvent[]
}

export type RhythmPattern = {
  id: string
  title: string
  timeSignature: TimeSignature
  bars: number
  tracks: RhythmTrack[]
  tags: string[]
  difficulty: number
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function patternLength(pattern: RhythmPattern): Fraction {
  const { numerator, denominator } = pattern.timeSignature
  return createFraction(pattern.bars * numerator, denominator)
}

// 이벤트나 붙임줄·잇단음표 묶음이 마디선을 넘으면 마디별로 따로 그릴 수 없어서 null 을 돌려준다.
export function splitIntoBars(pattern: RhythmPattern): RhythmPattern[] | null {
  const barLength = createFraction(pattern.timeSignature.numerator, pattern.timeSignature.denominator)
  const barStart = (bar: number) => createFraction(bar * barLength.numerator, barLength.denominator)
  const barOf = (event: RhythmEvent) => {
    let bar = 0
    while (bar + 1 < pattern.bars && compareFractions(event.onset, barStart(bar + 1)) >= 0) {
      bar++
    }
    return bar
  }
  const groupBars = new Map<string, number>()
  for (const track of pattern.tracks) {
    for (const event of track.events) {
      const bar = barOf(event)
      if (compareFractions(eventEnd(event), barStart(bar + 1)) > 0) {
        return null
      }
      for (const group of [event.notation.tieGroupId, event.notation.tupletGroup]) {
        const key = `${track.id}:${group}`
        if (group !== undefined && (groupBars.get(key) ?? bar) !== bar) {
          return null
        }
        if (group !== undefined) {
          groupBars.set(key, bar)
        }
      }
    }
  }
  return Array.from({ length: pattern.bars }, (_, bar) => ({
    ...pattern,
    id: `${pattern.id}-bar${bar + 1}`,
    bars: 1,
    tracks: pattern.tracks.map((track) => ({
      ...track,
      events: track.events
        .filter((event) => barOf(event) === bar)
        .map((event) => ({ ...event, onset: subtractFractions(event.onset, barStart(bar)) })),
    })),
  }))
}

function eventEnd(event: RhythmEvent): Fraction {
  return addFractions(event.onset, event.duration)
}

function validateEvent(event: RhythmEvent, length: Fraction, where: string): string[] {
  const errors: string[] = []
  for (const [name, value] of [
    ['onset', event.onset],
    ['길이', event.duration],
  ] as const) {
    if (!isNormalizedFraction(value)) {
      errors.push(`${where}: ${name} ${value.numerator}/${value.denominator} 는 기약분수가 아닙니다`)
    }
  }
  if (errors.length > 0) {
    return errors
  }
  if (event.onset.numerator < 0) {
    errors.push(`${where}: onset 은 음수일 수 없습니다`)
  }
  if (event.duration.numerator <= 0) {
    errors.push(`${where}: 길이는 0보다 커야 합니다`)
  }
  if (compareFractions(eventEnd(event), length) > 0) {
    errors.push(`${where}: ${formatFraction(eventEnd(event))} 에서 끝나 패턴 길이 ${formatFraction(length)} 를 넘습니다`)
  }
  if (event.notation.tuplet) {
    const { actual, normal } = event.notation.tuplet
    if (!isPositiveInteger(actual) || !isPositiveInteger(normal)) {
      errors.push(`${where}: 튜플릿 비율 ${actual}:${normal} 은 양의 정수여야 합니다`)
    }
  }
  if (!Number.isInteger(event.notation.dots) || event.notation.dots < 0) {
    errors.push(`${where}: 점 개수는 0 이상의 정수여야 합니다`)
  }
  return errors
}

function validateCoverage(track: RhythmTrack, length: Fraction): string[] {
  const errors: string[] = []
  const sorted = [...track.events].sort((left, right) => compareFractions(left.onset, right.onset))
  let cursor = createFraction(0, 1)
  for (const event of sorted) {
    const difference = compareFractions(event.onset, cursor)
    if (difference > 0) {
      errors.push(`트랙 ${track.id}: ${formatFraction(cursor)} 와 ${formatFraction(event.onset)} 사이에 빈틈이 있습니다`)
    } else if (difference < 0) {
      errors.push(`트랙 ${track.id}: 이벤트 ${event.id} 가 앞 이벤트와 겹칩니다`)
    }
    cursor = eventEnd(event)
  }
  if (compareFractions(cursor, length) !== 0) {
    errors.push(`트랙 ${track.id}: 마지막 이벤트가 ${formatFraction(cursor)} 에서 끝납니다. 패턴 길이는 ${formatFraction(length)} 입니다`)
  }
  return errors
}

function validateTies(track: RhythmTrack): string[] {
  const errors: string[] = []
  const sorted = [...track.events].sort((left, right) => compareFractions(left.onset, right.onset))
  const positionsByGroup = new Map<string, number[]>()
  sorted.forEach((event, index) => {
    const groupId = event.notation.tieGroupId
    if (groupId === undefined) {
      return
    }
    if (event.kind !== 'note') {
      errors.push(`트랙 ${track.id}: 붙임줄 ${groupId} 에 쉼표 ${event.id} 가 있습니다`)
    }
    positionsByGroup.set(groupId, [...(positionsByGroup.get(groupId) ?? []), index])
  })
  for (const [groupId, positions] of positionsByGroup) {
    if (positions.length < 2) {
      errors.push(`트랙 ${track.id}: 붙임줄 ${groupId} 는 음표가 2개 이상이어야 합니다`)
    }
    const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1)
    if (!contiguous) {
      errors.push(`트랙 ${track.id}: 붙임줄 ${groupId} 의 음표가 연속하지 않습니다`)
    }
  }
  return errors
}

export function validatePattern(pattern: RhythmPattern): string[] {
  const errors: string[] = []
  if (!isPositiveInteger(pattern.bars)) {
    errors.push(`마디 수 ${pattern.bars} 는 양의 정수여야 합니다`)
  }
  const { numerator, denominator } = pattern.timeSignature
  if (!isPositiveInteger(numerator) || !isPositiveInteger(denominator)) {
    errors.push(`박자표 ${numerator}/${denominator} 가 올바르지 않습니다`)
  }
  if (pattern.tracks.length === 0) {
    errors.push('트랙이 하나 이상 있어야 합니다')
  }
  if (errors.length > 0) {
    return errors
  }

  if (pattern.tracks.length > 1) {
    const roles = pattern.tracks.map((track) => track.role)
    if (roles.includes('single') || new Set(roles).size !== roles.length) {
      errors.push(`트랙이 여러 개면 역할은 left, right 로 서로 달라야 합니다: ${roles.join(', ')}`)
    }
  }

  const length = patternLength(pattern)
  const trackIds = new Set<string>()
  const eventIds = new Set<string>()
  for (const track of pattern.tracks) {
    if (trackIds.has(track.id)) {
      errors.push(`트랙 id ${track.id} 가 중복됩니다`)
    }
    trackIds.add(track.id)

    const eventErrors: string[] = []
    for (const event of track.events) {
      if (eventIds.has(event.id)) {
        errors.push(`이벤트 id ${event.id} 가 중복됩니다`)
      }
      eventIds.add(event.id)
      eventErrors.push(...validateEvent(event, length, `트랙 ${track.id} 이벤트 ${event.id}`))
    }
    errors.push(...eventErrors)
    if (eventErrors.length === 0) {
      errors.push(...validateCoverage(track, length), ...validateTies(track))
    }
  }
  return errors
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown, where: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where} 는 객체여야 합니다`)
  }
  return value as UnknownRecord
}

function readString(record: UnknownRecord, key: string, where: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`${where}.${key} 는 문자열이어야 합니다`)
  }
  return value
}

function readNumber(record: UnknownRecord, key: string, where: string): number {
  const value = record[key]
  if (typeof value !== 'number') {
    throw new Error(`${where}.${key} 는 숫자여야 합니다`)
  }
  return value
}

function readArray(record: UnknownRecord, key: string, where: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`${where}.${key} 는 배열이어야 합니다`)
  }
  return value
}

function readOneOf<T extends string>(record: UnknownRecord, key: string, allowed: readonly T[], where: string): T {
  const value = readString(record, key, where)
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${where}.${key} 는 ${allowed.join(', ')} 중 하나여야 합니다`)
  }
  return value as T
}

function parseEvent(raw: unknown, where: string): RhythmEvent {
  const record = asRecord(raw, where)
  const event: RhythmEvent = {
    id: readString(record, 'id', where),
    onset: parseFraction(readString(record, 'onset', where)),
    duration: parseFraction(readString(record, 'duration', where)),
    kind: readOneOf(record, 'kind', ['note', 'rest'] as const, where),
    notation: { dots: record.dots === undefined ? 0 : readNumber(record, 'dots', where) },
  }
  if (record.tuplet !== undefined) {
    const tuplet = asRecord(record.tuplet, `${where}.tuplet`)
    event.notation.tuplet = {
      actual: readNumber(tuplet, 'actual', `${where}.tuplet`),
      normal: readNumber(tuplet, 'normal', `${where}.tuplet`),
    }
  }
  if (record.tupletGroup !== undefined) {
    event.notation.tupletGroup = readString(record, 'tupletGroup', where)
  }
  if (record.tieGroupId !== undefined) {
    event.notation.tieGroupId = readString(record, 'tieGroupId', where)
  }
  if (record.accent !== undefined) {
    event.articulation = { accent: record.accent === true }
  }
  if (record.strum !== undefined) {
    const strum = asRecord(record.strum, `${where}.strum`)
    event.strum = {
      direction: readOneOf(strum, 'direction', ['down', 'up'] as const, `${where}.strum`),
      motion: readOneOf(strum, 'motion', ['sound', 'ghost'] as const, `${where}.strum`),
    }
  }
  return event
}

function parseTrack(raw: unknown, where: string): RhythmTrack {
  const record = asRecord(raw, where)
  return {
    id: readString(record, 'id', where),
    role: readOneOf(record, 'role', ['single', 'left', 'right'] as const, where),
    instrument: readOneOf(record, 'instrument', ['tap', 'percussion', 'guitar'] as const, where),
    events: readArray(record, 'events', where).map((event, index) => parseEvent(event, `${where}.events[${index}]`)),
  }
}

export function parsePattern(raw: unknown): RhythmPattern {
  const record = asRecord(raw, 'pattern')
  const id = readString(record, 'id', 'pattern')
  const where = `pattern ${id}`
  const timeSignature = asRecord(record.timeSignature, `${where}.timeSignature`)
  const pattern: RhythmPattern = {
    id,
    title: readString(record, 'title', where),
    timeSignature: {
      numerator: readNumber(timeSignature, 'numerator', `${where}.timeSignature`),
      denominator: readNumber(timeSignature, 'denominator', `${where}.timeSignature`),
    },
    bars: readNumber(record, 'bars', where),
    tracks: readArray(record, 'tracks', where).map((track, index) => parseTrack(track, `${where}.tracks[${index}]`)),
    tags: readArray(record, 'tags', where).map((tag) => String(tag)),
    difficulty: readNumber(record, 'difficulty', where),
  }
  const errors = validatePattern(pattern)
  if (errors.length > 0) {
    throw new Error(`${where} 가 규칙을 어깁니다\n- ${errors.join('\n- ')}`)
  }
  return pattern
}
