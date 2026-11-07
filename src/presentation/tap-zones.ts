import type { RhythmPattern, StrumDirection } from '../domain/rhythm/pattern.ts'

export type TapZone = {
  id: string
  label: string
  hint: string
  trackId: string
  direction?: StrumDirection
  keys: string[]
}

const LEFT_KEYS = ['a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'arrowleft', 'arrowdown']
const RIGHT_KEYS = ['h', 'j', 'k', 'l', ';', 'n', 'm', ',', '.', 'arrowright', 'arrowup']

export function hasStrum(pattern: RhythmPattern): boolean {
  return pattern.tracks.some((track) => track.events.some((event) => event.strum !== undefined))
}

export function tapZonesFor(pattern: RhythmPattern, splitStrum: boolean): TapZone[] {
  if (pattern.tracks.length > 1) {
    const left = pattern.tracks.find((track) => track.role === 'left') ?? pattern.tracks[0]
    const right = pattern.tracks.find((track) => track.role === 'right') ?? pattern.tracks[1]
    return [
      { id: 'left', label: '왼손', hint: 'F 키 · 왼쪽 반', trackId: left.id, keys: LEFT_KEYS },
      { id: 'right', label: '오른손', hint: 'J 키 · 오른쪽 반', trackId: right.id, keys: RIGHT_KEYS },
    ]
  }
  const trackId = pattern.tracks[0].id
  if (splitStrum && hasStrum(pattern)) {
    return [
      { id: 'down', label: '↓ 다운', hint: 'F 키 · ↓', trackId, direction: 'down', keys: LEFT_KEYS },
      { id: 'up', label: '↑ 업', hint: 'J 키 · ↑', trackId, direction: 'up', keys: RIGHT_KEYS },
    ]
  }
  return [{ id: 'single', label: '탭', hint: '화면 아무 곳이나 · 키보드 아무 키', trackId, keys: [] }]
}

export function zoneForKey(zones: TapZone[], key: string): TapZone | null {
  if (zones.length === 1) {
    return zones[0]
  }
  return zones.find((zone) => zone.keys.includes(key.toLowerCase())) ?? null
}
