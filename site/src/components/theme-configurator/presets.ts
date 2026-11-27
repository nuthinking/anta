/**
 * What each choice does: it scales limit variables from `tokens.css`, and
 * nothing else, so a theme only sets variables. The numbers are first guesses,
 * tuned against the contact sheet (`site/scripts/theme-contact-sheet.mjs`).
 */
import type { ChoiceId, Level } from './model.ts'
import type { LimitVar, Limits, Mode } from './templates.ts'

/** Per level: [first option, Standard, last option]. */
export const FACTORS = {
  /** Chroma scale. Also scales chroma when re-deriving Antune and Antithesis. */
  color: [0.7, 1, 1.25],
  /** Chroma cap multiplier, gentler than the scale so vivid seeds stay in gamut. */
  colorCap: [0.8, 1, 1.15],
  /** Multiplier on hover and pressed lightness shifts. */
  state: [0.5, 1, 1.5],
} as const

/** Limit variables each choice owns. */
export const LIMITS_OWNED: Record<ChoiceId, LimitVar[]> = {
  color: ['--anta-solid-c-scale', '--anta-solid-c-max', '--anta-fg-c-scale', '--anta-fg-c-max'],
  state: ['--anta-solid-l-hover', '--anta-solid-l-active', '--anta-fg-l-hover'],
}

const round = (n: number) => Math.round(n * 10000) / 10000

/**
 * `base` with one choice applied at `level`. Only the variables the choice owns
 * change. For All components (`forAll`), Colorfulness is Intensity: the seeds
 * carry the chroma change (see `effectiveSeeds`), so only the caps move here.
 */
export function applyLimitChoice(base: Limits, choice: ChoiceId, level: Level, mode: Mode, forAll = false): Limits {
  const out = { ...base }
  if (level === 1) return out
  if (choice === 'color') {
    if (!forAll) {
      out['--anta-solid-c-scale'] = round(base['--anta-solid-c-scale'] * FACTORS.color[level])
      out['--anta-fg-c-scale'] = round(base['--anta-fg-c-scale'] * FACTORS.color[level])
    }
    out['--anta-solid-c-max'] = round(base['--anta-solid-c-max'] * FACTORS.colorCap[level])
    out['--anta-fg-c-max'] = round(base['--anta-fg-c-max'] * FACTORS.colorCap[level])
  } else if (choice === 'state') {
    for (const k of LIMITS_OWNED.state) out[k] = round(base[k] * FACTORS.state[level])
  }
  return out
}

export const chromaFactor = (level: Level) => FACTORS.color[level]
