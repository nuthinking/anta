/**
 * Theme configurator state. The configurator only generates CSS: this state
 * records dial and choice positions plus hand edits, and `generate.ts` turns
 * it into the theme file.
 */
import { SEED, TONES, type Tone } from '../theming-lab-formulas.ts'

/** Index into a three-way choice: 0 = first option, 1 = Standard, 2 = last option. */
export type Level = 0 | 1 | 2
export type Mode = 'light' | 'dark'
export type ChoiceId = 'color' | 'state'
export type NeutralMode = 'grey' | 'tinted' | 'custom'
/** `brand`: status colors follow the brand (Anta's brand gives Anta's); `custom`: `seeds` holds them. */
export type StatusMode = 'brand' | 'custom'
export type Base = 'default' | 'antune' | 'antera' | 'antithesis'

export const MODES: readonly Mode[] = ['light', 'dark']
export const LEVELS: readonly Level[] = [0, 1, 2]
/** The All components entry. Every family inherits its choices and limits. */
export const ALL = 'all'

/**
 * Choices that set limit variables only, so a theme stays a few readable
 * lines. Choices that would rewrite component formulas (fill strength, tint
 * alpha) are left out on purpose.
 */
export const CHOICES: Record<ChoiceId, { label: string; options: readonly [string, string, string] }> = {
  color: { label: 'Colorfulness', options: ['Muted', 'Standard', 'Vivid'] },
  state: { label: 'State change', options: ['Subtle', 'Standard', 'Strong'] },
}
export const CHOICE_IDS = Object.keys(CHOICES) as ChoiceId[]

/** Hand edits for one family, per mode, keyed by `editKey(scope, prop)`. */
export type Edits = Partial<Record<Mode, Record<string, string>>>

/** System font stacks only: themes must not load hosted fonts. */
export const FONTS = [
  { id: 'default', label: 'Default', stack: '' },
  { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'neo-grotesque', label: 'Neo-grotesque', stack: 'Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif' },
  { id: 'humanist', label: 'Humanist', stack: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif' },
  { id: 'geometric', label: 'Geometric', stack: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif' },
] as const
export type FontId = (typeof FONTS)[number]['id']

export interface TypeSettings {
  font: FontId
  titles: 'sans' | 'serif'
  size: Level
}

export interface ThemeState {
  base: Base
  seeds: Record<Tone, string>
  /** `tinted` turns the base's neutral with the brand hue (the base's brand gives its own neutral); `custom` uses `seeds.neutral`; `grey` drops neutral chroma. */
  neutral: NeutralMode
  status: StatusMode
  /** Per family and for `ALL`; a family without its own level inherits `ALL`'s. */
  choices: Record<string, Partial<Record<ChoiceId, Level>>>
  edits: Record<string, Edits>
  type: TypeSettings
  /** Corner style: Square, Soft, Round. Soft is Anta's default. */
  corners: Level
}

/** Anta's own values, so the default state generates an empty theme. */
export const defaultState = (): ThemeState => ({
  base: 'default',
  seeds: { ...SEED },
  neutral: 'tinted',
  status: 'brand',
  choices: {},
  edits: {},
  type: { font: 'default', titles: 'sans', size: 1 },
  corners: 1,
})

/**
 * A fresh state for a base, starting from that base's own seeds (Antithesis
 * declares some of its own). Anta's seeds when none are given.
 */
export const stateFor = (base: Base, seeds: Record<Tone, string> = SEED): ThemeState => ({ ...defaultState(), base, seeds: { ...seeds } })

/** Looks up a base's own seeds. */
export type SeedsFor = (base: Base) => Record<Tone, string>
const antaSeeds: SeedsFor = () => SEED

export const editKey = (scope: string, prop: string) => `${scope}|${prop}`

/** The effective level of a choice for a family: its own, else All components'. */
export function levelOf(state: ThemeState, family: string, choice: ChoiceId): Level {
  return state.choices[family]?.[choice] ?? state.choices[ALL]?.[choice] ?? 1
}

const HEX = /^#[0-9a-f]{6}$/i
const isLevel = (v: unknown): v is Level => v === 0 || v === 1 || v === 2
const FAMILY_ID = /^[a-z]{1,20}$/

/**
 * Serialise dials and choices for the URL hash. Hand edits are left out:
 * they can be long, so they live in session storage instead.
 */
export function encodeState(state: ThemeState, seedsFor: SeedsFor = antaSeeds): string {
  const d = defaultState()
  const own = seedsFor(state.base)
  const seeds = Object.fromEntries(TONES.filter((t) => state.seeds[t] !== own[t]).map((t) => [t, state.seeds[t]]))
  const choices = Object.fromEntries(
    Object.entries(state.choices)
      .map(([f, c]) => [f, Object.fromEntries(Object.entries(c ?? {}).filter(([, l]) => l !== undefined))])
      .filter(([, c]) => Object.keys(c).length > 0),
  )
  const out: Record<string, unknown> = { v: 2 }
  if (state.base !== d.base) out.base = state.base
  if (Object.keys(seeds).length) out.seeds = seeds
  if (state.neutral !== d.neutral) out.neutral = state.neutral
  if (state.status !== d.status) out.status = state.status
  if (Object.keys(choices).length) out.choices = choices
  if (JSON.stringify(state.type) !== JSON.stringify(d.type)) out.type = state.type
  if (state.corners !== d.corners) out.corners = state.corners
  return encodeURIComponent(JSON.stringify(out))
}

/** Parse `encodeState` output. Unknown or malformed fields fall back to defaults. */
export function decodeState(hash: string, seedsFor: SeedsFor = antaSeeds): ThemeState {
  const state = defaultState()
  let raw: any
  try {
    raw = JSON.parse(decodeURIComponent(hash.replace(/^#/, '')))
  } catch {
    return state
  }
  if (!raw || typeof raw !== 'object') return state
  if (raw.base === 'antune' || raw.base === 'antera' || raw.base === 'antithesis' || raw.base === 'default') state.base = raw.base
  // Seeds in the link are changes from the base's own seeds.
  state.seeds = { ...seedsFor(state.base) }
  for (const t of TONES) if (typeof raw.seeds?.[t] === 'string' && HEX.test(raw.seeds[t])) state.seeds[t] = raw.seeds[t].toLowerCase()
  if (raw.neutral === 'grey' || raw.neutral === 'tinted' || raw.neutral === 'custom') state.neutral = raw.neutral
  // Links from before status colors followed the brand carry custom status seeds.
  if (raw.status === 'brand' || raw.status === 'custom') state.status = raw.status
  else if (['info', 'success', 'warning', 'critical'].some((k) => raw.seeds?.[k])) state.status = 'custom'
  if (raw.choices && typeof raw.choices === 'object') {
    for (const [family, choices] of Object.entries(raw.choices as Record<string, unknown>)) {
      if (!FAMILY_ID.test(family) || !choices || typeof choices !== 'object') continue
      for (const id of CHOICE_IDS) {
        const level = (choices as Record<string, unknown>)[id]
        if (isLevel(level)) (state.choices[family] ??= {})[id] = level
      }
    }
  }
  if (raw.type && typeof raw.type === 'object') {
    const font = FONTS.find((f) => f.id === raw.type.font)
    if (font) state.type.font = font.id
    if (raw.type.titles === 'serif' || raw.type.titles === 'sans') state.type.titles = raw.type.titles
    if (isLevel(raw.type.size)) state.type.size = raw.type.size
  }
  if (isLevel(raw.corners)) state.corners = raw.corners
  return state
}
