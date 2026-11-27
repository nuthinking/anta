/**
 * Turns configurator state into CSS. Pure: no DOM, no Preact, so it runs in
 * `node --test` and in the contact-sheet script.
 *
 * Every color line comes from a template read out of the shipped CSS
 * (`templates.ts`) and keeps its `var(--anta-solid-…)` limit references, as
 * Anta's own CSS does. Limits are set as variables: All components' at the
 * root, an entry's own on its component. The theme file contains only what
 * differs from Anta. (`src/AGENTS.md` keeps these variables internal to the
 * package docs; the configurator uses them so a theme stays short.)
 */
import type { Tone } from '../theming-lab-formulas.ts'
import { ALL, CHOICE_IDS, FONTS, defaultState, editKey, levelOf, type ChoiceId, type Mode, type ThemeState } from './model.ts'
import { LIMITS_OWNED, applyLimitChoice, chromaFactor } from './presets.ts'
import { cornerRules } from './corners.ts'
import { hexToOklch, oklchToHex } from './color.ts'
import { rederive } from './rederive.ts'
import { LIMIT_VARS, renderValue, type FamilyTemplate, type LimitVar, type Limits, type RenderParams, type Templates } from './templates.ts'

export interface Decl {
  family: string
  /** Role families: the tone. Component families: the rule key. `ALL`: `root`. */
  scope: string
  prop: string
  light: string
  dark: string
}

const MODES: Mode[] = ['light', 'dark']
const fmt = (n: number) => String(+n.toFixed(4))

export const familyTemplate = (t: Templates, id: string): FamilyTemplate => {
  const f = t.families.find((x) => x.id === id)
  if (!f) throw new Error(`Unknown family: ${id}`)
  return f
}

/** Values a hand edit may never contain, so user text cannot leave its declaration. */
const UNSAFE = /url\(|@import|[;{}<>\\]|\/\*|\*\//i
export const isSafeValue = (value: string) => value.trim() !== '' && value.length < 300 && !UNSAFE.test(value)

/** All components' limits: Anta's defaults, then its choices, then its hand edits. */
export function globalLimits(t: Templates, state: ThemeState): Record<Mode, Limits> {
  const out = {} as Record<Mode, Limits>
  for (const mode of MODES) {
    let l = { ...t.limits[mode] }
    for (const choice of CHOICE_IDS) l = applyLimitChoice(l, choice, levelOf(state, ALL, choice), mode, true)
    const edits = state.edits[ALL]?.[mode] ?? {}
    for (const name of LIMIT_VARS) {
      const v = edits[editKey('root', name)]
      if (v !== undefined && Number.isFinite(Number(v))) l[name] = Number(v)
    }
    out[mode] = l
  }
  return out
}

/** Scope of a component entry's own limit lines. */
export const LIMIT_SCOPE = 'limits'

/** A family's limits: All components', with its own choices and its edited limit lines applied. */
export function familyLimits(t: Templates, state: ThemeState, family: string): Record<Mode, Limits> {
  const g = globalLimits(t, state)
  for (const choice of CHOICE_IDS) {
    const own = state.choices[family]?.[choice]
    if (own === undefined || own === levelOf(state, ALL, choice)) continue
    for (const mode of MODES) {
      const recomputed = applyLimitChoice(t.limits[mode], choice, own, mode)
      for (const k of LIMITS_OWNED[choice]) g[mode][k] = recomputed[k]
    }
  }
  for (const mode of MODES) {
    const edits = state.edits[family]?.[mode] ?? {}
    for (const name of LIMIT_VARS) {
      const v = edits[editKey(LIMIT_SCOPE, name)]
      if (v !== undefined && Number.isFinite(Number(v))) g[mode][name] = Number(v)
    }
  }
  return g
}

/** Limit variables a family's lines read. */
const usedLimits = (f: FamilyTemplate): LimitVar[] =>
  LIMIT_VARS.filter((name) => f.rules.some((r) => r.lines.some((l) => l.light.includes(`var(${name})`) || l.dark.includes(`var(${name})`))))

/** Limits that differ between a family and All components, in one mode. */
const ownLimits = (fam: Limits, global: Limits): Partial<Limits> =>
  Object.fromEntries(LIMIT_VARS.filter((k) => fam[k] !== global[k]).map((k) => [k, fam[k]]))

const NEUTRAL_SEED_LINE = /^oklch\(from var\(--anta-seed-neutral\) (\S+) (\d*\.?\d+) h\)$/

function generatedDecls(t: Templates, state: ThemeState, family: string): Decl[] {
  if (family === ALL) {
    const g = globalLimits(t, state)
    return LIMIT_VARS.map((prop) => ({ family, scope: 'root', prop, light: fmt(g.light[prop]), dark: fmt(g.dark[prop]) }))
  }
  const f = familyTemplate(t, family)
  const limits = familyLimits(t, state, family)
  const global = globalLimits(t, state)
  // Lines keep their limit references. Role families are page-level tokens, so
  // their own limits cannot be scoped and are written in as numbers instead.
  const params = (mode: Mode): RenderParams => ({
    limits: f.kind === 'role' ? ownLimits(limits[mode], global[mode]) : {},
  })
  const p = { light: params('light'), dark: params('dark') }
  // Component entries list the limits they read, so their choices and edits can set them.
  const out: Decl[] = f.kind === 'role'
    ? []
    : usedLimits(f).map((prop) => ({ family, scope: LIMIT_SCOPE, prop, light: fmt(limits.light[prop]), dark: fmt(limits.dark[prop]) }))
  for (const rule of f.rules) {
    // Neutral role tokens keep Anta's fixed values; only the Grey option touches them.
    const neutral = rule.scope === 'neutral'
    for (const line of rule.lines) {
      const render = (value: string, mode: Mode) => {
        if (!neutral) return renderValue(value, p[mode])
        if (state.neutral !== 'grey') return value
        return value.replace(NEUTRAL_SEED_LINE, (_, l) => `oklch(from var(--anta-seed-neutral) ${l} 0 h)`)
      }
      out.push({ family, scope: rule.scope, prop: line.prop, light: render(line.light, 'light'), dark: render(line.dark, 'dark') })
    }
  }
  return out
}

/** A family's lines with hand edits applied. Unsafe edits are ignored. */
export function familyDecls(t: Templates, state: ThemeState, family: string): Decl[] {
  const edits = family === ALL ? undefined : state.edits[family]
  return generatedDecls(t, state, family).map((d) => {
    const key = editKey(d.scope, d.prop)
    const pick = (mode: Mode) => {
      const e = edits?.[mode]?.[key]
      return e !== undefined && isSafeValue(e) ? e.trim().replace(/\s+/g, ' ') : d[mode]
    }
    return { ...d, light: pick('light'), dark: pick('dark') }
  })
}

const baselines = new WeakMap<Templates, Map<string, Map<string, Decl>>>()
function baseline(t: Templates, family: string): Map<string, Decl> {
  let byFamily = baselines.get(t)
  if (!byFamily) baselines.set(t, (byFamily = new Map()))
  let b = byFamily.get(family)
  if (!b) {
    b = new Map(familyDecls(t, defaultState(), family).map((d) => [editKey(d.scope, d.prop), d]))
    byFamily.set(family, b)
  }
  return b
}

/**
 * Lines that reach the theme file, in either mode; both modes are kept for
 * them. Formula lines count when they differ from Anta's; a component entry's
 * limit lines count when they differ from All components', which the root sets.
 */
export function changedDecls(t: Templates, state: ThemeState, family: string): Decl[] {
  const b = baseline(t, family)
  const global = family === ALL ? null : globalLimits(t, state)
  return familyDecls(t, state, family).filter((d) => changedIn(d, b, global, 'light') || changedIn(d, b, global, 'dark'))
}

function changedIn(d: Decl, b: Map<string, Decl>, global: Record<Mode, Limits> | null, mode: Mode): boolean {
  if (d.scope === LIMIT_SCOPE && global) return Number(d[mode]) !== global[mode][d.prop as LimitVar]
  const base = b.get(editKey(d.scope, d.prop))
  return !base || base[mode] !== d[mode]
}

/** Whether a line reaches the theme file in one mode, for marking it in the editor. */
export function lineChanged(t: Templates, state: ThemeState, family: string, prop: string, mode: Mode): boolean {
  const d = familyDecls(t, state, family).find((x) => x.prop === prop)
  if (!d) return false
  return changedIn(d, baseline(t, family), family === ALL ? null : globalLimits(t, state), mode)
}

/** Families that differ from All components, for the "Follows All" marker. */
export function followsAll(t: Templates, state: ThemeState, family: string): boolean {
  if (Object.keys(state.edits[family]?.light ?? {}).length || Object.keys(state.edits[family]?.dark ?? {}).length) return false
  return CHOICE_IDS.every((c) => state.choices[family]?.[c] === undefined || state.choices[family]![c] === levelOf(state, ALL, c))
}

/**
 * Effective seed per tone, after the Neutral dial. `own` is the base's own
 * seeds: Anta's for Default.
 */
export function effectiveSeeds(state: ThemeState, own: Record<Tone, string> = defaultState().seeds): Record<Tone, string> {
  const seeds = { ...state.seeds }
  if (state.status === 'brand') for (const tone of STATUS_TONES) seeds[tone] = harmonizedStatus(own[tone], state.seeds.brand, own.brand)
  // Intensity scales the brand and status seeds' chroma; every derived color follows.
  const k = chromaFactor(levelOf(state, ALL, 'color'))
  if (k !== 1) for (const tone of INTENSITY_TONES) seeds[tone] = scaleChroma(seeds[tone], k)
  if (state.neutral === 'tinted') seeds.neutral = tintedNeutral(state.seeds.brand, own)
  else if (state.neutral === 'grey') seeds.neutral = own.neutral
  return seeds
}

const INTENSITY_TONES = ['brand', 'info', 'success', 'warning', 'critical'] as const
export const STATUS_TONES = ['info', 'success', 'warning', 'critical'] as const

/** How far a status hue leans toward a brand: a quarter of the gap, at most 15°. */
const lean = (statusHue: number, brandHue: number) => {
  const gap = ((brandHue - statusHue + 540) % 360) - 180
  return Math.sign(gap) * Math.min(15, Math.abs(gap) / 4)
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * A status color that follows the brand. Everything is relative to the base's
 * own brand, so that brand gives the base's own status color exactly. The hue
 * moves at most 8° and chroma at most 15%, so each status keeps its meaning:
 * red stays red. Lightness follows half the brand's change.
 */
export function harmonizedStatus(status: string, brand: string, ownBrand: string): string {
  if (brand.toLowerCase() === ownBrand.toLowerCase()) return status
  const s = hexToOklch(status)
  const b = hexToOklch(brand)
  const o = hexToOklch(ownBrand)
  const h = (s.h + clamp(lean(s.h, b.h) - lean(s.h, o.h), -8, 8) + 360) % 360
  const c = s.c * clamp(b.c / Math.max(o.c, 1e-4), 0.85, 1.15)
  const l = clamp(s.l + (b.l - o.l) / 2, 0.4, 0.75)
  return oklchToHex({ l, c, h })
}
const INTENSITY_LABELS = ['Muted', 'Balanced', 'Vivid'] as const

/** The same hue and lightness with chroma scaled, brought into sRGB. */
export function scaleChroma(hex: string, k: number): string {
  const c = hexToOklch(hex)
  return oklchToHex({ ...c, c: c.c * k })
}

/**
 * Tinted keeps the base's own neutral, a low-chroma grey whose hue sits a
 * fixed step from the brand's, and turns its hue with the brand. The base's
 * brand therefore gives exactly the base's neutral.
 */
export function tintedNeutral(brand: string, own: Record<Tone, string> = defaultState().seeds): string {
  if (brand.toLowerCase() === own.brand) return own.neutral
  const ownBrand = hexToOklch(own.brand)
  const ownNeutral = hexToOklch(own.neutral)
  const h = (hexToOklch(brand).h + ownNeutral.h - ownBrand.h + 360) % 360
  return `oklch(${fmt(ownNeutral.l)} ${fmt(ownNeutral.c)} ${fmt(h)})`
}

export interface RenderOptions {
  /** Limit color rules to this selector, for side-by-side previews. Omit for a theme file. */
  scope?: string
}

const TEXT_SIZE = [0.92, 1, 1.08] as const

function typeLines(t: Templates, state: ThemeState): string[] {
  const lines: string[] = []
  const font = FONTS.find((f) => f.id === state.type.font)
  if (font?.stack) lines.push(`--sans-serif: ${font.stack};`)
  const k = TEXT_SIZE[state.type.size]
  if (k !== 1) for (const [name, px] of Object.entries(t.fontSizes)) lines.push(`${name}: ${Math.round(px * k)}px;`)
  return lines
}

const block = (selector: string, lines: string[], indent = '') =>
  lines.length ? `${indent}${selector.replace(/\n/g, `\n${indent}`)} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}` : ''

const withScope = (selectors: string[], scope?: string) => selectors.map((s) => (scope ? `${scope} ${s}` : s)).join(',\n')

/**
 * The theme file, or scoped CSS for a preview. Empty when nothing differs.
 *
 * Seeds, role tokens and type tokens stay unlayered, as in `tokens.css` and
 * both shipped themes: a layered override of an unlayered token loses. The
 * file must load after `tokens.css`. Component rules go in `@layer anta.theme`.
 */
export function renderTheme(t: Templates, state: ThemeState, options: RenderOptions = {}): string {
  const { scope } = options
  const rootSel = scope ?? ':root, .light'
  const darkSel = scope ? `${scope}.dark` : '.dark'
  const d0 = defaultState().seeds
  const seeds = effectiveSeeds(state)

  const level = levelOf(state, ALL, 'color')
  // A seed changed by Intensity says which color it came from.
  const note = (k: Tone) => (level !== 1 && k !== 'neutral' ? ` /* ${state.seeds[k]} at ${INTENSITY_LABELS[level]} intensity */` : '')
  const rootLines = (Object.keys(seeds) as Tone[]).filter((k) => seeds[k] !== d0[k]).map((k) => `--anta-seed-${k}: ${seeds[k]};${note(k)}`)
  rootLines.push(...typeLines(t, state))
  const darkLines: string[] = []
  const layered: string[] = []

  // All components' limits, as variables beside Anta's own in tokens.css.
  const g = globalLimits(t, state)
  for (const name of LIMIT_VARS) {
    if (g.light[name] === t.limits.light[name] && g.dark[name] === t.limits.dark[name]) continue
    rootLines.push(`${name}: ${fmt(g.light[name])};`)
    darkLines.push(`${name}: ${fmt(g.dark[name])};`)
  }

  for (const f of t.families) {
    const decls = changedDecls(t, state, f.id)
    if (!decls.length) continue
    if (f.kind === 'role') {
      for (const d of decls) {
        rootLines.push(`${d.prop}: ${d.light};`)
        darkLines.push(`${d.prop}: ${d.dark};`)
      }
      continue
    }
    // An entry's own limits, on every element its rules style; the dark values under .dark.
    const limitDecls = decls.filter((d) => d.scope === LIMIT_SCOPE)
    if (limitDecls.length) {
      const selectors = [...new Set(f.rules.flatMap((r) => r.selectors))]
      layered.push(block(withScope(selectors, scope), limitDecls.map((d) => `${d.prop}: ${d.light};`), '  '))
      const dark = selectors.map((sel) => (scope ? `${scope}.dark ${sel}` : `.dark ${sel}`))
      layered.push(block(dark.join(',\n'), limitDecls.map((d) => `${d.prop}: ${d.dark};`), '  '))
    }
    for (const rule of f.rules) {
      const lines = decls
        .filter((d) => d.scope === rule.scope)
        .map((d) => `${d.prop}: ${d.light === d.dark ? d.light : `light-dark(${d.light}, ${d.dark})`};`)
      layered.push(block(withScope(rule.selectors, scope), lines, '  '))
    }
  }
  if (state.type.titles === 'serif') {
    layered.push(block(withScope(['a-title:is([level="1"], [level="2"], [level="3"]):not([font])'], scope), ['font-family: var(--serif);'], '  '))
  }
  if (!scope) layered.push(...cornerRules(state.corners).map((b) => b.replace(/^/gm, '  ')))

  const tokens = [block(rootSel, rootLines), block(darkSel, darkLines)].filter(Boolean)
  const components = layered.filter(Boolean)
  if (!tokens.length && !components.length) return ''
  const parts = ['@layer base, anta, components, utilities;\n@layer anta.reset, anta.components, anta.theme;', ...tokens]
  if (components.length) parts.push(`@layer anta.theme {\n${components.join('\n\n')}\n}`)
  return `${parts.join('\n\n')}\n`
}

const LAYER_HEADER = /^@layer base, anta, components, utilities;\n@layer anta\.reset, anta\.components, anta\.theme;\n\n/

/**
 * A shipped theme (Antune, Antithesis) re-derived for the state's seeds and
 * Intensity (see `rederive.ts`), followed by the type and corner dials. The
 * theme's own seeds and Anta's type and corners give back the shipped file.
 * Fine-tune per component works on Default only, so its choices and edits
 * are ignored here.
 */
export function renderShipped(t: Templates, state: ThemeState, css: string, own: Record<Tone, string>): string {
  const to = effectiveSeeds(state, own)
  // The neutral seed may be an oklch() string (Tinted); rederive works in hex.
  const toHex = { ...to, neutral: to.neutral.startsWith('#') ? to.neutral : oklchToHex(parseOklch(to.neutral)) }
  // Intensity is already in the seeds (effectiveSeeds), so re-deriving needs no extra chroma factor.
  let out = rederive(css, own, toHex, { chroma: 1, greyNeutral: state.neutral === 'grey' })
  // Seeds the theme does not declare still drive Anta's formula tokens it leaves alone.
  const added = (Object.keys(to) as Tone[]).filter((k) => to[k] !== own[k] && !new RegExp(`--anta-seed-${k}\\s*:`).test(css))
  if (added.length) out = `${out.trimEnd()}\n\n:root, .light {\n${added.map((k) => `  --anta-seed-${k}: ${to[k]};`).join('\n')}\n}\n`
  const extras = renderTheme(t, { ...defaultState(), type: state.type, corners: state.corners })
  if (extras) out = `${out.trimEnd()}\n\n/* Type and shape from the theme configurator. */\n${extras.replace(LAYER_HEADER, '')}`
  return out
}

function parseOklch(value: string) {
  const [l, c, h] = value.replace(/^oklch\(|\)$/g, '').trim().split(/\s+/).map(Number)
  return { l, c, h }
}
