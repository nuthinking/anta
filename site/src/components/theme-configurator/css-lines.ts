/**
 * Reads the CSS a person edits for one entry and mode: one declaration per
 * line, `/* … *\/` comment lines, and blank lines. The same reading decides
 * which lines apply and which problems the editor marks, so a marked line is
 * exactly a line the configurator ignores. Pure, so it runs in tests.
 */
import { isSafeValue } from './generate.ts'

export type Severity = 'error' | 'warning'

export interface Problem {
  /** Character offsets into the text. */
  from: number
  to: number
  severity: Severity
  message: string
}

export interface ParsedLine {
  prop: string
  value: string
  from: number
  to: number
}

export interface Reading {
  /** Declarations that apply: known, safe, and last for their property. */
  lines: ParsedLine[]
  problems: Problem[]
}

const DECL = /^(\s*)(--[\w-]+)(\s*):(\s*)(.*?)(\s*)(;?)(\s*)$/
const COMMENT = /^\s*\/\*.*\*\/\s*$/

/** Unbalanced parentheses, or a closing one before its opening. */
function parensBalanced(value: string): boolean {
  let depth = 0
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')' && --depth < 0) return false
  }
  return depth === 0
}

/**
 * Checks each line. `known` lists the properties this entry may set.
 * `isColor` tells whether a value is a valid color (the browser's
 * `CSS.supports`); without it, colors are not checked.
 */
export function readCss(text: string, known: Set<string>, isColor?: (value: string) => boolean): Reading {
  const problems: Problem[] = []
  const lines: ParsedLine[] = []
  const lastFor = new Map<string, number>()
  let offset = 0
  for (const raw of text.split('\n')) {
    const from = offset
    const to = offset + raw.length
    offset = to + 1
    if (!raw.trim() || COMMENT.test(raw)) continue
    const lead = raw.length - raw.trimStart().length
    const span = { from: from + lead, to: from + raw.trimEnd().length }
    const m = DECL.exec(raw)
    if (!m) {
      const message = !raw.includes(':')
        ? 'Expected a declaration: --name: value;'
        : /^\s*[a-z]/i.test(raw) && !raw.trimStart().startsWith('--')
          ? 'Only custom properties (--name) can be edited here.'
          : 'Could not read this line.'
      problems.push({ ...span, severity: 'error', message })
      continue
    }
    const [, , prop, , , value, , semi] = m
    const propFrom = from + m[1].length
    const valueFrom = from + m[1].length + prop.length + m[3].length + 1 + m[4].length
    const valueSpan = { from: valueFrom, to: valueFrom + value.length }
    if (!known.has(prop)) {
      problems.push({ from: propFrom, to: propFrom + prop.length, severity: 'error', message: `${prop} is not a line of this entry, so it is ignored.` })
      continue
    }
    if (!value) {
      problems.push({ ...span, severity: 'error', message: 'Missing value.' })
      continue
    }
    if (!isSafeValue(value)) {
      problems.push({ ...valueSpan, severity: 'error', message: 'Values cannot contain url(), @import, comments, braces, semicolons or angle brackets.' })
      continue
    }
    if (!parensBalanced(value)) {
      problems.push({ ...valueSpan, severity: 'error', message: 'Unbalanced parentheses.' })
      continue
    }
    if (isColor && /^(oklch|oklab|rgb|rgba|hsl|hsla|lab|lch|color|color-mix|light-dark)\(|^#/i.test(value) && !isColor(value)) {
      problems.push({ ...valueSpan, severity: 'error', message: 'Not a valid color.' })
      continue
    }
    if (!semi) problems.push({ from: span.to, to: span.to, severity: 'warning', message: 'Missing semicolon.' })
    const previous = lastFor.get(prop)
    if (previous !== undefined) {
      const earlier = lines[previous]
      problems.push({ from: earlier.from, to: earlier.to, severity: 'warning', message: `${prop} is set again below; the last one applies.` })
      lines[previous] = { prop, value, from: span.from, to: span.to }
      continue
    }
    lastFor.set(prop, lines.length)
    lines.push({ prop, value, from: span.from, to: span.to })
  }
  return { lines, problems }
}
