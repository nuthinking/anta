/**
 * Re-derives a shipped theme (Antune, Antithesis) for new seeds. Both themes
 * set hand-tuned literal colors, which the seed formulas never reach, so the
 * configurator rewrites the literals themselves.
 *
 * Each literal belongs to a tone: the tone its token or selector names
 * (`--bg-3-brand`, `[tone="critical"]`), else neutral for a low-chroma color,
 * else the tone whose seed hue is nearest. When that tone's seed changes, the
 * literal keeps its lightness, turns its hue by the seed's hue change, and
 * scales its chroma by the seed's chroma change. The theme's hand-tuned
 * lightness steps, and so its contrast, stay as shipped. Achromatic literals
 * (white, black, pure greys) stay fixed. A tone whose seed is unchanged keeps
 * its text exactly, so the theme's own seeds reproduce the shipped file.
 */
import { SEED, TONES, type Tone } from '../theming-lab-formulas.ts'
import { hexToOklch, oklchToHex, type Oklch } from './color.ts'

export interface RederiveOptions {
  /** Chroma factor for every tone but neutral (Intensity). */
  chroma: number
  /** Drop neutral chroma (the Grey neutral). */
  greyNeutral: boolean
}

/** Below this chroma a literal has no meaningful hue: it never changes. */
const ACHROMATIC = 0.004
/** Untagged literals below this chroma count as neutral. */
const NEUTRAL_CHROMA = 0.06
/** sRGB's most chromatic colors sit near 0.32; nothing needs more. */
const MAX_CHROMA = 0.37

const TONE_WORD = /\b(?:neutral|brand|info|success|warning|critical)\b|-(neutral|brand|info|success|warning|critical)\b/g
const SEED_DECL = /^\s*--anta-seed-(neutral|brand|info|success|warning|critical)\s*$/
const LITERAL = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b|oklch\(\s*(\d*\.?\d+)(%?)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*(\/\s*[^)]+)?\)/gi

/** The theme's seeds: Anta's, with any `--anta-seed-*` the theme declares. */
export function shippedSeeds(css: string): Record<Tone, string> {
  const seeds = { ...SEED }
  for (const m of css.matchAll(/--anta-seed-(neutral|brand|info|success|warning|critical)\s*:\s*(#[0-9a-f]{6})\b/gi)) {
    const tone = m[1] as Tone
    if (seeds[tone] === SEED[tone]) seeds[tone] = m[2].toLowerCase()
  }
  return seeds
}

function lastTone(text: string): Tone | null {
  let tone: Tone | null = null
  for (const m of text.toLowerCase().matchAll(TONE_WORD)) tone = (m[1] ?? m[0]) as Tone
  return tone
}

function parseHex(hex: string): { color: Oklch; alpha: number } {
  let h = hex.slice(1)
  if (h.length <= 4) h = [...h].map((ch) => ch + ch).join('')
  const alpha = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1
  return { color: hexToOklch(`#${h.slice(0, 6)}`), alpha }
}

const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const fmt = (n: number) => String(+n.toFixed(4))

interface Shift { dh: number; k: number; grey: boolean }

/**
 * The shipped theme with its literals moved from the `from` seeds to the `to`
 * seeds. Comments and formatting are kept; only color values change.
 */
export function rederive(css: string, from: Record<Tone, string>, to: Record<Tone, string>, options: RederiveOptions): string {
  const fromColor = Object.fromEntries(TONES.map((t) => [t, hexToOklch(from[t])])) as Record<Tone, Oklch>
  const shifts: Partial<Record<Tone, Shift>> = {}
  for (const tone of TONES) {
    const grey = tone === 'neutral' && options.greyNeutral
    const factor = tone === 'neutral' ? 1 : options.chroma
    if (from[tone] === to[tone] && factor === 1 && !grey) continue
    const a = fromColor[tone]
    const b = hexToOklch(to[tone])
    shifts[tone] = { dh: b.h - a.h, k: (b.c / Math.max(a.c, 1e-4)) * factor, grey }
  }
  if (!Object.keys(shifts).length && TONES.every((t) => from[t] === to[t])) return css

  const nearestTone = (c: Oklch): Tone => {
    let best: Tone = 'brand'
    for (const t of TONES) if (t !== 'neutral' && hueDistance(c.h, fromColor[t].h) < hueDistance(c.h, fromColor[best].h)) best = t
    return best
  }

  const moveLiteral = (literal: string, context: Tone | null, focus: boolean): string => {
    const isHex = literal.startsWith('#')
    let color: Oklch
    let alpha = 1
    let alphaText = ''
    if (isHex) {
      ;({ color, alpha } = parseHex(literal))
    } else {
      const m = /oklch\(\s*(\d*\.?\d+)(%?)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*(\/\s*[^)]+)?\)/i.exec(literal)!
      color = { l: Number(m[1]) / (m[2] ? 100 : 1), c: Number(m[3]), h: Number(m[4]) }
      alphaText = m[5] ? ` ${m[5].replace(/\s+/g, ' ').trim()}` : ''
    }
    if (color.c < ACHROMATIC) return literal
    const tone = context ?? (focus ? 'brand' : color.c < NEUTRAL_CHROMA ? 'neutral' : nearestTone(color))
    const shift = shifts[tone]
    if (!shift) return literal
    const next: Oklch = shift.grey
      ? { ...color, c: 0 }
      : { l: color.l, c: Math.min(MAX_CHROMA, color.c * shift.k), h: (color.h + shift.dh + 360) % 360 }
    return isHex ? oklchToHex(next, alpha) : `oklch(${fmt(next.l)} ${fmt(next.c)} ${fmt(next.h)}${alphaText})`
  }

  // Walk the file: comments are copied through, selectors are stacked, and
  // each declaration's value is rewritten.
  let out = ''
  const stack: string[] = []
  let i = 0
  let start = 0
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    const ch = css[i]
    if (ch === '{' || ch === '}' || ch === ';') {
      const segment = css.slice(start, i)
      if (ch === '{') {
        stack.push(segment.replace(/\/\*[\s\S]*?\*\//g, '').trim())
        out += segment
      } else {
        out += rewriteDeclaration(segment)
        if (ch === '}') stack.pop()
      }
      out += ch
      start = i + 1
    }
    i++
  }
  out += css.slice(start)
  return out

  function rewriteDeclaration(segment: string): string {
    // Blank out comments at the same length, so positions match the original.
    const masked = segment.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))
    const colon = masked.indexOf(':')
    if (colon < 0) return segment
    const prop = masked.slice(0, colon)
    const seed = SEED_DECL.exec(prop)
    let context = seed ? (seed[1] as Tone) : lastTone(prop)
    for (let s = stack.length - 1; !context && s >= 0; s--) context = lastTone(stack[s])
    const focus = /focus/.test(prop)
    let result = ''
    let last = 0
    for (const m of masked.slice(colon + 1).matchAll(LITERAL)) {
      const at = colon + 1 + m.index!
      const replacement = seed
        ? (from[context!] === to[context!] ? m[0] : to[context!])
        : moveLiteral(m[0], context, focus)
      result += segment.slice(last, at) + replacement
      last = at + m[0].length
    }
    return last ? result + segment.slice(last) : segment
  }
}
