import { describe, expect, it } from 'vitest'
import { STAGES } from '../curriculum/stages.ts'
import { figureById } from '../rhythm/figures.ts'
import { rest, note } from '../rhythm/generator.ts'
import { validatePattern } from '../rhythm/pattern.ts'
import { makeChoiceQuestion, makeComposeQuestion, rhythmSignature, wrongBeats } from './dictation.ts'

const specsFrom = (index: number) => STAGES.slice(0, index + 1).reverse().map((stage) => stage.spec)

describe('makeChoiceQuestion', () => {
  it('gives four valid options that all sound different', () => {
    for (const index of [0, 5, 20, 60, STAGES.length - 1]) {
      for (let seed = 0; seed < 5; seed++) {
        const question = makeChoiceQuestion(specsFrom(index), seed)
        expect(question.options).toHaveLength(4)
        question.options.forEach((option) => expect(validatePattern(option)).toEqual([]))
        expect(new Set(question.options.map(rhythmSignature)).size).toBe(4)
        expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('wrongBeats', () => {
  const quarter = figureById('quarter').cells[0]
  const eighths = figureById('two-eighths').cells[0]
  const syncopation = figureById('eighth-quarter-eighth').cells[0]

  it('treats sounding-alike cells as correct', () => {
    const shortNote = { beats: 1 as const, items: [note(1, 8), rest(1, 8)] }
    expect(wrongBeats([quarter, eighths], [shortNote, eighths])).toEqual([])
  })

  it('compares beats across differently sized cells', () => {
    expect(wrongBeats([syncopation], [eighths, eighths])).toEqual([1])
    expect(wrongBeats([syncopation, quarter, quarter], [syncopation, quarter, eighths])).toEqual([3])
  })

  it('builds compose questions from the stage cells', () => {
    const question = makeComposeQuestion(STAGES[10].spec, 4)
    expect(question.totalBeats).toBe(STAGES[10].spec.beatsPerBar * STAGES[10].spec.bars)
    expect(wrongBeats(question.answerCells, question.answerCells)).toEqual([])
    expect(question.palette.length).toBeGreaterThan(1)
  })
})
