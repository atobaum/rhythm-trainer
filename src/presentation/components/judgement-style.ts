import type { Grade, Judgement } from '../../domain/evaluation/matcher.ts'

export type MarkKind = Grade | 'miss' | 'extra' | 'pending' | 'direction'

export const MARK_LABELS: Record<MarkKind, string> = {
  perfect: 'Perfect',
  great: 'Great',
  good: 'Good',
  miss: 'Miss',
  extra: 'Extra',
  pending: '',
  direction: '방향',
}

export const MARK_SYMBOLS: Record<MarkKind, string> = {
  perfect: '◎',
  great: '○',
  good: '△',
  miss: '✕',
  extra: '!',
  pending: '·',
  direction: '⇅',
}

export function markOf(judgement: Judgement): MarkKind {
  if (judgement.kind === 'hit') {
    return judgement.wrongDirection ? 'direction' : judgement.grade
  }
  return judgement.kind
}

export function describeError(errorMs: number): string {
  const rounded = Math.round(errorMs)
  if (rounded === 0) {
    return '정확'
  }
  return rounded < 0 ? `${-rounded}ms 빠름` : `${rounded}ms 늦음`
}
