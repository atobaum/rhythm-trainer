import {
  Annotation,
  BarlineType,
  AnnotationVerticalJustify,
  Articulation,
  Beam,
  Dot,
  Formatter,
  Modifier,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow/bravura'
import { compareFractions, fractionToNumber } from '../../domain/rhythm/fraction.ts'
import { patternLength } from '../../domain/rhythm/pattern.ts'
import type { RhythmEvent, RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { toNotationDuration } from './duration-code.ts'

export type ScoreLayout = {
  height: number
  xOfPatternPosition: (position: number) => number
}

const NOTE_KEY = 'b/4'
const STAVE_TOP = 18
const SCORE_HEIGHT = 96
const MINIMAL_HEIGHT = 80
const ROW_HEIGHT = 80
const STAVE_RIGHT_PADDING = 10
// 두 손 악보는 음 사이 간격이 시간에 비례해야 어느 손이 언제 치는지 보인다.
const MULTI_TRACK_SOFTMAX_FACTOR = 100
const NO_LINES = [false, false, false, false, false].map((visible) => ({ visible }))
const MIDDLE_LINE_ONLY = [false, false, true, false, false].map((visible) => ({ visible }))

export const notationFontsReady: Promise<void> =
  typeof document === 'undefined' ? Promise.resolve() : document.fonts.load('30px Bravura').then(() => undefined)

function isGhostStroke(event: RhythmEvent): boolean {
  return event.strum?.motion === 'ghost'
}

function buildNote(event: RhythmEvent): StaveNote {
  const notation = toNotationDuration(event.duration, event.notation.tuplet)
  if (notation === null) {
    throw new Error(`악보로 쓸 수 없는 음가입니다: ${event.id}`)
  }
  const isRest = event.kind === 'rest' || isGhostStroke(event)
  const note = new StaveNote({
    keys: [NOTE_KEY],
    duration: `${notation.code}${isRest ? 'r' : ''}`,
    dots: notation.dots,
    stemDirection: Stem.UP,
  })
  if (notation.dots > 0) {
    Dot.buildAndAttach([note], { all: true })
  }
  if (event.strum) {
    const arrow = event.strum.direction === 'down' ? '↓' : '↑'
    note.addModifier(
      new Annotation(isGhostStroke(event) ? `(${arrow})` : arrow).setVerticalJustification(AnnotationVerticalJustify.TOP),
      0,
    )
  }
  if (event.articulation?.accent && !isRest) {
    note.addModifier(new Articulation('a>').setPosition(Modifier.Position.ABOVE), 0)
  }
  return note
}

function buildTuplets(events: RhythmEvent[], notes: StaveNote[]): Tuplet[] {
  const tuplets: Tuplet[] = []
  let index = 0
  while (index < events.length) {
    const tuplet = events[index].notation.tuplet
    if (!tuplet) {
      index++
      continue
    }
    const groupId = events[index].notation.tupletGroup
    let size = tuplet.actual
    if (groupId !== undefined) {
      size = 0
      while (index + size < events.length && events[index + size].notation.tupletGroup === groupId) {
        size++
      }
    }
    tuplets.push(new Tuplet(notes.slice(index, index + size), { numNotes: tuplet.actual, notesOccupied: tuplet.normal }))
    index += size
  }
  return tuplets
}

function eventsInBar(events: RhythmEvent[], barStart: number, barEnd: number): RhythmEvent[] {
  return events.filter((event) => {
    const onset = fractionToNumber(event.onset)
    return onset >= barStart && onset < barEnd
  })
}

export function renderScore(
  container: HTMLElement,
  pattern: RhythmPattern,
  width: number,
  options: { minimal?: boolean } = {},
): ScoreLayout {
  container.replaceChildren()
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG)
  const extraRows = pattern.tracks.length - 1
  const height = (options.minimal ? MINIMAL_HEIGHT : SCORE_HEIGHT) + extraRows * ROW_HEIGHT
  renderer.resize(width, height)
  const context = renderer.getContext()
  context.setFillStyle('currentColor')
  context.setStrokeStyle('currentColor')

  const barLength = fractionToNumber(patternLength(pattern)) / pattern.bars
  const barWidth = width / pattern.bars
  const anchors: { position: number; x: number }[] = []
  let lastStaveEnd = width

  const tracks = pattern.tracks.map((track) => {
    const sortedEvents = [...track.events].sort((left, right) => compareFractions(left.onset, right.onset))
    return { track, sortedEvents, notesByEventId: new Map<string, StaveNote>() }
  })

  for (let bar = 0; bar < pattern.bars; bar++) {
    const rows = tracks.map(({ track, sortedEvents, notesByEventId }, row) => {
      const y = (options.minimal ? 0 : STAVE_TOP) + row * ROW_HEIGHT
      const stave = new Stave(bar * barWidth, y, barWidth - (bar === pattern.bars - 1 ? 1 : 0))
      stave.setConfigForLines(options.minimal ? NO_LINES : MIDDLE_LINE_ONLY)
      if (options.minimal) {
        stave.setBegBarType(BarlineType.NONE).setEndBarType(BarlineType.NONE)
      } else if (bar === 0) {
        stave.addClef('percussion').addTimeSignature(`${pattern.timeSignature.numerator}/${pattern.timeSignature.denominator}`)
        if (tracks.length > 1) {
          stave.setStaveText(track.role === 'left' ? 'L' : 'R', Modifier.Position.LEFT)
        }
      }
      stave.setContext(context).draw()
      const barEvents = eventsInBar(sortedEvents, bar * barLength, (bar + 1) * barLength)
      const notes = barEvents.map(buildNote)
      barEvents.forEach((event, index) => notesByEventId.set(event.id, notes[index]))
      const tuplets = buildTuplets(barEvents, notes)
      const voice = new Voice({ numBeats: pattern.timeSignature.numerator, beatValue: pattern.timeSignature.denominator })
      voice.setMode(Voice.Mode.SOFT).addTickables(notes)
      return { stave, barEvents, notes, voice, tuplets, beams: Beam.generateBeams(notes, { stemDirection: Stem.UP }) }
    })

    const formatter = new Formatter(tracks.length > 1 ? { softmaxFactor: MULTI_TRACK_SOFTMAX_FACTOR } : {})
    rows.forEach((row) => formatter.joinVoices([row.voice]))
    const firstStave = rows[0].stave
    formatter.format(
      rows.map((row) => row.voice),
      firstStave.getNoteEndX() - firstStave.getNoteStartX() - STAVE_RIGHT_PADDING,
    )
    for (const row of rows) {
      row.voice.draw(context, row.stave)
      row.beams.forEach((beam) => beam.setContext(context).draw())
      row.tuplets.forEach((tuplet) => tuplet.setContext(context).draw())
      row.barEvents.forEach((event, index) => {
        const note = row.notes[index]
        anchors.push({
          position: fractionToNumber(event.onset),
          x: (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2,
        })
      })
    }
    lastStaveEnd = firstStave.getX() + firstStave.getWidth()
  }

  for (const { sortedEvents, notesByEventId } of tracks) {
    for (let index = 1; index < sortedEvents.length; index++) {
      const previous = sortedEvents[index - 1]
      const event = sortedEvents[index]
      const tieGroupId = event.notation.tieGroupId
      if (tieGroupId !== undefined && previous.notation.tieGroupId === tieGroupId) {
        new StaveTie({
          firstNote: notesByEventId.get(previous.id),
          lastNote: notesByEventId.get(event.id),
          firstIndexes: [0],
          lastIndexes: [0],
        })
          .setContext(context)
          .draw()
      }
    }
  }

  const totalLength = fractionToNumber(patternLength(pattern))
  anchors.push({ position: totalLength, x: lastStaveEnd - 8 })
  anchors.sort((left, right) => left.position - right.position)

  const xOfPatternPosition = (position: number) => {
    const target = position * totalLength
    if (target <= anchors[0].position) {
      return anchors[0].x / width
    }
    for (let index = 1; index < anchors.length; index++) {
      const right = anchors[index]
      if (target <= right.position) {
        const left = anchors[index - 1]
        const ratio = right.position === left.position ? 0 : (target - left.position) / (right.position - left.position)
        return (left.x + (right.x - left.x) * ratio) / width
      }
    }
    return anchors[anchors.length - 1].x / width
  }

  return { height, xOfPatternPosition }
}
