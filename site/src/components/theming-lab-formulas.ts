/**
 * Data for the theming lab (`ThemingLab.tsx`). Each entry describes one toned
 * component: the tunable constants its custom-tone oklch formula uses (light and
 * dark defaults, transcribed verbatim from the element's `src/elements/a-*.css`),
 * how they group by priority / role, and a `css()` that renders those constants
 * back into the formula text.
 *
 * `css(sel, seed, v)` returns the CSS that drives the generative preview. The lab
 * injects it un-layered (beating `@layer anta`) scoped to a per-tone container, and
 * shows the same string as the "CSS output". At the default values it reproduces
 * Anta's own generative output — a visual no-op — so only an edited value makes the
 * generative preview diverge from the hand-tuned reference.
 *
 * Colored tones follow their seed's lightness and chroma within limits, and
 * Neutral keeps fixed values. The specs express both with one formula: a
 * lightness window plus a scaled, capped chroma. Neutral's defaults close the
 * window to one lightness and cap the chroma at its fixed value, so the same
 * formula reproduces Anta's neutral output.
 *
 * `vars` is the flat, unique set of constants (drives `defaults()` and `css()`).
 * `groups` is the display split: one entry per priority (or role), listing the keys
 * it exposes. A key may appear in more than one group — a lower priority that
 * reuses a higher one's constants repeats those inputs (they stay in sync) with a
 * `note` saying so. This mirrors Anta's formulas, where e.g. a Button's tertiary
 * and quaternary reuse the secondary foreground/tint.
 */

/** One tunable constant, with its light and dark defaults and input bounds. */
export interface VarDef {
  key: string
  label: string
  light: number
  dark: number
  /** Neutral-tone default overrides. Neutral is hand-authored grey, not a
   *  formula-derived tone, so it can want per-key values the colored tones don't
   *  share. When set, it wins over `light`/`dark` (and the `NEUTRAL_CHROMA`
   *  fallback) for the neutral panel only. */
  neutral?: { light?: number; dark?: number }
  min: number
  max: number
  step: number
  tip?: string
}

/** A display group of variables — one priority (or role) of a component. */
export interface VarGroup {
  label: string
  keys: string[]
  /** Shown under the group header, e.g. when a priority reuses another's knobs. */
  note?: string
}

export type Vals = Record<string, number>

export interface ComponentSpec {
  /** Slug used in the generative container class (`.tl-gen-{tone}-{id}`). */
  id: string
  /** Heading text. */
  title: string
  /** One line under the header explaining what the formula does. */
  blurb: string
  /** The flat, unique set of tunable constants. */
  vars: VarDef[]
  /** How the constants split into per-priority / per-role expanders. */
  groups: VarGroup[]
  /**
   * Role-token spec: the formula emits global role tokens (e.g. `--text-*`) that
   * the sample components inherit, rather than styling one element. `Block` then
   * scopes injection to the preview container (`.tl-gen-…`) and displays it at
   * `:root`, and the generative samples render untoned so they read the tokens.
   */
  tokens?: boolean
  /**
   * The generative-driving CSS. `sel` is the element selector (bare `a-title` for
   * the displayed code, the scoped `.tl-gen-… a-title` / `.dark .tl-gen-… a-title`
   * for injection); `seed` is the source color; `v` the current theme's values.
   * For a `tokens` spec, `sel` is `:root` (display) or the container (injection).
   */
  css: (sel: string, seed: string, v: Vals) => string
}

/** Tones, Neutral first. Each seed is the shipped primary-rest light literal. */
export const TONES = ['neutral', 'brand', 'info', 'success', 'warning', 'critical'] as const
export type Tone = (typeof TONES)[number]

export const TONE_LABEL: Record<Tone, string> = {
  neutral: 'Neutral',
  brand: 'Brand',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  critical: 'Critical',
}

export const SEED: Record<Tone, string> = {
  neutral: '#635b65',
  brand: '#5f4bc3',
  info: '#1f6eb2',
  success: '#2a7e43',
  warning: '#c37416',
  critical: '#c9302c',
}

/** `oklch(from <seed> L C h)`, the shape every formula uses. */
const ok = (seed: string, l: number | string, c: number | string) =>
  `oklch(from ${seed} ${l} ${c} h)`

/** A computed constant, trimmed to four decimals as in `tokens.css`. */
const num = (n: number) => String(+n.toFixed(4))

/** The seed's lightness inside `min…max`, with its chroma scaled and capped.
 *  Solid fills and text-like foregrounds share this shape. */
const within = (seed: string, min: number, max: number, scale: number, cap: number) =>
  `oklch(from ${seed} clamp(${min}, l, ${max}) min(calc(c * ${scale}), ${cap}) h)`

/** `color` with `by` added to its lightness. */
const shift = (color: string, by: number) => `oklch(from ${color} calc(l + ${by}) c h)`

/** The label or mark on a solid fill: `light` lightness on a fill darker than
 *  `flip`, 0.15 on a lighter one. */
const onSolid = (fill: string, flip: number, light = 1) =>
  `oklch(from ${fill} calc(0.15 + ${num(light - 0.15)} * clamp(0, (${flip} - l) * 1000, 1)) 0 h)`

const v3 = (min = 0, max = 1, step = 0.005) => ({ min, max, step })
const pct = { min: 0, max: 100, step: 1 }

export const SPECS: ComponentSpec[] = [
  {
    id: 'surface',
    title: 'Background & Borders',
    blurb:
      'The container background and border role scales. Each step keeps a pinned lightness: backgrounds sit near the page with a faint tint that grows per step, and borders step from a saturated edge (border-1) to the faint border-5. Chroma scales with the seed. At the reference chroma a step gets the chroma listed here, a more muted seed gets less, and a more vivid one gets at most the headroom multiple. Neutral pins its chroma by setting the reference near zero.',
    vars: [
      { key: 'bg1L', label: 'bg-1 L', light: 1, dark: 0, ...v3() },
      { key: 'bg2L', label: 'bg-2 L', light: 0.99, dark: 0.13, neutral: { light: 0.985, dark: 0.16 }, ...v3() },
      { key: 'bg2C', label: 'bg-2 C', light: 0.004, dark: 0.02, neutral: { light: 0.002, dark: 0.002 }, ...v3(0, 0.4) },
      { key: 'bg3L', label: 'bg-3 L', light: 0.972, dark: 0.17, neutral: { light: 0.97, dark: 0.177 }, ...v3() },
      { key: 'bg3C', label: 'bg-3 C', light: 0.011, dark: 0.035, neutral: { light: 0.004, dark: 0.005 }, ...v3(0, 0.4) },
      { key: 'bg4L', label: 'bg-4 L', light: 0.955, dark: 0.185, neutral: { light: 0.954, dark: 0.191 }, ...v3() },
      { key: 'bg4C', label: 'bg-4 C', light: 0.02, dark: 0.05, neutral: { light: 0.004, dark: 0.006 }, ...v3(0, 0.4) },
      { key: 'bg5L', label: 'bg-5 L', light: 0.935, dark: 0.205, neutral: { dark: 0.2 }, ...v3() },
      { key: 'bg5C', label: 'bg-5 C', light: 0.03, dark: 0.055, neutral: { light: 0.006, dark: 0.009 }, ...v3(0, 0.4) },
      { key: 'bd1L', label: 'border-1 L', light: 0.67, dark: 0.52, ...v3() },
      { key: 'bd1C', label: 'border-1 C', light: 0.13, dark: 0.15, ...v3(0, 0.4) },
      { key: 'bd2L', label: 'border-2 L', light: 0.8, dark: 0.41, ...v3() },
      { key: 'bd2C', label: 'border-2 C', light: 0.09, dark: 0.12, ...v3(0, 0.4) },
      { key: 'bd3L', label: 'border-3 L', light: 0.86, dark: 0.33, ...v3() },
      { key: 'bd3C', label: 'border-3 C', light: 0.055, dark: 0.09, ...v3(0, 0.4) },
      { key: 'bd4L', label: 'border-4 L', light: 0.9, dark: 0.26, ...v3() },
      { key: 'bd4C', label: 'border-4 C', light: 0.04, dark: 0.06, ...v3(0, 0.4) },
      { key: 'bd5L', label: 'border-5 L', light: 0.935, dark: 0.21, ...v3() },
      { key: 'bd5C', label: 'border-5 C', light: 0.028, dark: 0.045, ...v3(0, 0.4) },
      { key: 'chromaRef', label: 'reference C', light: 0.17, dark: 0.17, neutral: { light: 0.001, dark: 0.001 }, ...v3(0.001, 0.4, 0.001), tip: 'Seed chroma at which each step gets the chroma listed for it. Neutral sets it near zero, so every step takes its listed chroma.' },
      { key: 'chromaHeadroom', label: 'C headroom', light: 1.25, dark: 1.25, neutral: { light: 1, dark: 1 }, ...v3(1, 2, 0.05), tip: 'How far above its listed chroma a step may go for a seed more vivid than the reference.' },
    ],
    groups: [
      { label: 'Background', keys: ['bg1L', 'bg2L', 'bg2C', 'bg3L', 'bg3C', 'bg4L', 'bg4C', 'bg5L', 'bg5C'] },
      { label: 'Border', keys: ['bd1L', 'bd1C', 'bd2L', 'bd2C', 'bd3L', 'bd3C', 'bd4L', 'bd4C', 'bd5L', 'bd5C'] },
      { label: 'Seed chroma', keys: ['chromaRef', 'chromaHeadroom'], note: 'Shared by every background and border step.' },
    ],
    css: (sel, seed, v) => {
      const step = (l: number, c: number) =>
        `oklch(from ${seed} ${l} min(calc(c * ${num(c / v.chromaRef)}), ${num(c * v.chromaHeadroom)}) h)`
      return `${sel} {
  --bg-1: ${ok(seed, v.bg1L, 0)};
  --bg-2: ${step(v.bg2L, v.bg2C)};
  --bg-3: ${step(v.bg3L, v.bg3C)};
  --bg-4: ${step(v.bg4L, v.bg4C)};
  --bg-5: ${step(v.bg5L, v.bg5C)};
  --border-1: ${step(v.bd1L, v.bd1C)};
  --border-2: ${step(v.bd2L, v.bd2C)};
  --border-3: ${step(v.bd3L, v.bd3C)};
  --border-4: ${step(v.bd4L, v.bd4C)};
  --border-5: ${step(v.bd5L, v.bd5C)};
}`
    },
  },

  {
    id: 'text',
    title: 'Text',
    blurb:
      'The text color role scale. text-2 is the base: it takes the seed’s lightness inside a window, which keeps it readable on a surface, and the seed’s chroma, scaled and capped. text-1 is the strong primary, a lightness step away from text-2 with less chroma. text-3/4 step text-2 down by alpha; Title and Text read text-1..4 as their priorities. text-5 is the faintest step (the disabled / hint tone). Neutral closes the window to one lightness.',
    vars: [
      { key: 'fgMin', label: 'text-2 L min', light: 0.3, dark: 0.86, neutral: { light: 0.3, dark: 0.8 }, ...v3(), tip: 'Lower end of the lightness window. In dark mode this end sets contrast with the surface.' },
      { key: 'fgMax', label: 'text-2 L max', light: 0.46, dark: 0.92, neutral: { light: 0.3, dark: 0.8 }, ...v3(), tip: 'Upper end of the lightness window. In light mode this end sets contrast with the surface.' },
      { key: 'fgScale', label: 'text-2 C scale', light: 1, dark: 0.75, neutral: { light: 1, dark: 1 }, ...v3(0, 2, 0.05), tip: 'Multiplies the seed’s chroma.' },
      { key: 'fgCap', label: 'text-2 C cap', light: 0.17, dark: 0.13, neutral: { light: 0.015, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'strongShift', label: 'text-1 L shift', light: -0.05, dark: 0.04, neutral: { light: -0.2, dark: 0.14 }, ...v3(-0.5, 0.5), tip: 'Added to text-2’s lightness.' },
      { key: 'strongChroma', label: 'text-1 C scale', light: 0.75, dark: 0.75, neutral: { light: 0.6667, dark: 0.5333 }, ...v3(0, 2, 0.05), tip: 'Multiplies text-2’s chroma.' },
      { key: 'tertA', label: 'text-3 α %', light: 82, dark: 80, ...pct },
      { key: 'quatA', label: 'text-4 α %', light: 66, dark: 62, ...pct },
      { key: 'quinA', label: 'text-5 α %', light: 40, dark: 40, ...pct },
    ],
    groups: [
      { label: 'Secondary', keys: ['fgMin', 'fgMax', 'fgScale', 'fgCap'], note: 'text-2 base.' },
      { label: 'Primary', keys: ['strongShift', 'strongChroma'], note: 'text-1, derived from text-2.' },
      { label: 'Tertiary', keys: ['tertA'], note: 'text-2 base at this alpha (→ text-3).' },
      { label: 'Quaternary', keys: ['quatA'], note: 'text-2 base at this alpha (→ text-4).' },
      { label: 'Faint (text-5)', keys: ['quinA'], note: 'text-2 base at this alpha (→ text-5) — the disabled / hint step, not a Title/Text priority.' },
    ],
    tokens: true,
    css: (sel, seed, v) => `${sel} {
  --text-2: ${within(seed, v.fgMin, v.fgMax, v.fgScale, v.fgCap)};
  --text-1: oklch(from var(--text-2) calc(l + ${v.strongShift}) calc(c * ${v.strongChroma}) h);
  --text-3: color-mix(in oklch, var(--text-2) ${v.tertA}%, transparent);
  --text-4: color-mix(in oklch, var(--text-2) ${v.quatA}%, transparent);
  --text-5: color-mix(in oklch, var(--text-2) ${v.quinA}%, transparent);
}`,
  },

  {
    id: 'button',
    title: 'Buttons',
    blurb:
      'The primary fill takes the seed’s lightness inside a window and its chroma, scaled and capped. Hover and active shift that lightness, and the label turns from white to dark above the flip point. Secondary, tertiary, and quaternary share one foreground, which takes the seed’s lightness inside a narrower window. Secondary and tertiary share an alpha-tinted fill at a pinned lightness (tertiary a step softer, transparent at rest); quaternary has none. Neutral closes both windows to one lightness.',
    vars: [
      { key: 'solidMin', label: 'fill L min', light: 0.42, dark: 0.38, neutral: { light: 0.5, dark: 0.4 }, ...v3(), tip: 'A darker seed is raised to this lightness.' },
      { key: 'solidMax', label: 'fill L max', light: 0.85, dark: 0.8, neutral: { light: 0.5, dark: 0.4 }, ...v3(), tip: 'A lighter seed is lowered to this lightness.' },
      { key: 'solidHover', label: 'hover L shift', light: -0.05, dark: 0.04, ...v3(-0.3, 0.3) },
      { key: 'solidActive', label: 'active L shift', light: -0.1, dark: 0.08, ...v3(-0.3, 0.3) },
      { key: 'solidScale', label: 'fill C scale', light: 1, dark: 0.9, neutral: { light: 2, dark: 2 }, ...v3(0, 2, 0.05), tip: 'Multiplies the seed’s chroma.' },
      { key: 'solidCap', label: 'fill C cap', light: 0.22, dark: 0.2, neutral: { light: 0.02, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'flip', label: 'label flip L', light: 0.72, dark: 0.72, ...v3(), tip: 'The label is white on a fill darker than this and dark on a lighter one. 0.72 is where APCA rates the two equal. WCAG 2 puts that point near 0.58.' },
      { key: 'fgMin', label: 'fg L min', light: 0.3, dark: 0.86, neutral: { light: 0.46, dark: 0.86 }, ...v3() },
      { key: 'fgMax', label: 'fg L max', light: 0.46, dark: 0.92, neutral: { light: 0.46, dark: 0.86 }, ...v3() },
      { key: 'fgHover', label: 'fg hover L shift', light: -0.06, dark: 0, ...v3(-0.3, 0.3) },
      { key: 'fgScale', label: 'fg C scale', light: 1, dark: 0.75, neutral: { light: 1, dark: 1 }, ...v3(0, 2, 0.05) },
      { key: 'fgCap', label: 'fg C cap', light: 0.17, dark: 0.13, neutral: { light: 0.008, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'bgL', label: 'tint L', light: 0.54, dark: 0.58, neutral: { dark: 0.44 }, ...v3(), tip: 'Pinned. The seed’s lightness does not reach the tint.' },
      { key: 'tintScale', label: 'tint C scale', light: 1, dark: 1, neutral: { light: 2, dark: 2 }, ...v3(0, 2, 0.05) },
      { key: 'tintCap', label: 'tint C cap', light: 0.17, dark: 0.16, neutral: { light: 0.03, dark: 0.01 }, ...v3(0, 0.4) },
      { key: 'aRest', label: 'α rest', light: 0.1, dark: 0.215, neutral: { dark: 0.24 }, ...v3() },
      { key: 'aHover', label: 'α hover', light: 0.15, dark: 0.29, neutral: { dark: 0.34 }, ...v3() },
      { key: 'aActive', label: 'α active', light: 0.2, dark: 0.34, neutral: { dark: 0.44 }, ...v3() },
      { key: 'quatHover', label: 'hover L shift', light: -0.08, dark: 0.04, ...v3(-0.3, 0.3), tip: 'Quaternary hover lightness shift, its own value. Rest and active carry the rest α; hover is opaque.' },
      { key: 'quatRestA', label: 'α rest', light: 0.85, dark: 0.85, ...v3(), tip: 'Alpha on the quaternary rest (and active) foreground. Light-mode neutral needs ≈0.83 to clear WCAG AA (4.5:1) over bg-2.' },
    ],
    groups: [
      { label: 'Primary', keys: ['solidMin', 'solidMax', 'solidHover', 'solidActive', 'solidScale', 'solidCap', 'flip'] },
      { label: 'Secondary', keys: ['fgMin', 'fgMax', 'fgHover', 'fgScale', 'fgCap', 'bgL', 'tintScale', 'tintCap', 'aRest', 'aHover', 'aActive'] },
      { label: 'Tertiary', keys: ['fgMin', 'fgMax', 'fgHover', 'fgScale', 'fgCap', 'bgL', 'tintScale', 'tintCap', 'aRest', 'aHover'], note: 'Reuses the secondary foreground + tint (no separate Anta constant).' },
      { label: 'Quaternary', keys: ['fgMin', 'fgMax', 'fgScale', 'fgCap', 'quatHover', 'quatRestA'], note: 'Rest (and active) is the tertiary foreground at the rest α; hover uses its own lightness shift at full opacity. No fill.' },
    ],
    css: (sel, seed, v) => {
      const tint = (a: number) => `oklch(from ${seed} ${v.bgL} min(calc(c * ${v.tintScale}), ${v.tintCap}) h / ${a})`
      return `${sel} {
  --_solid: ${within(seed, v.solidMin, v.solidMax, v.solidScale, v.solidCap)};
  --_fg:    ${within(seed, v.fgMin, v.fgMax, v.fgScale, v.fgCap)};

  --button-bg-primary-rest:   var(--_solid);
  --button-bg-primary-hover:  ${shift('var(--_solid)', v.solidHover)};
  --button-bg-primary-active: ${shift('var(--_solid)', v.solidActive)};
  --button-fg-primary-rest:   ${onSolid('var(--button-bg-primary-rest)', v.flip)};

  --button-fg-secondary-rest:   var(--_fg);
  --button-fg-secondary-hover:  ${shift('var(--_fg)', v.fgHover)};
  --button-fg-tertiary-rest:    var(--_fg);
  --button-fg-tertiary-hover:   ${shift('var(--_fg)', v.fgHover)};
  --button-fg-quaternary-rest:  oklch(from var(--_fg) l c h / ${v.quatRestA});
  --button-fg-quaternary-hover: ${shift('var(--_fg)', v.quatHover)};

  --button-bg-secondary-rest:   ${tint(v.aRest)};
  --button-bg-secondary-hover:  ${tint(v.aHover)};
  --button-bg-secondary-active: ${tint(v.aActive)};
  --button-bg-tertiary-hover:   ${tint(v.aRest)};
  --button-bg-tertiary-active:  ${tint(v.aHover)};
}`
    },
  },

  {
    id: 'tag',
    title: 'Tags',
    blurb:
      'Primary is a solid fill that takes the seed’s lightness inside a window and its chroma, scaled and capped; its label turns from white to dark above the flip point. Secondary is an alpha tint at a pinned lightness; tertiary an outline. The label and edge are the Text scale — edge = --text-2, label = --text-2 at the label α (--text-3’s), tunable per Tag (e.g. raise it for small-text contrast). Alphas set each priority’s strength. Neutral closes the window to one lightness.',
    vars: [
      { key: 'solidMin', label: 'solid L min', light: 0.42, dark: 0.38, neutral: { light: 0.55, dark: 0.48 }, ...v3() },
      { key: 'solidMax', label: 'solid L max', light: 0.85, dark: 0.8, neutral: { light: 0.55, dark: 0.48 }, ...v3() },
      { key: 'solidScale', label: 'solid C scale', light: 1, dark: 0.9, neutral: { light: 2, dark: 2 }, ...v3(0, 2, 0.05), tip: 'Multiplies the seed’s chroma.' },
      { key: 'solidCap', label: 'solid C cap', light: 0.22, dark: 0.2, neutral: { light: 0.015, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'flip', label: 'label flip L', light: 0.72, dark: 0.72, ...v3(), tip: 'The label is white on a fill darker than this and dark on a lighter one.' },
      { key: 'tintL', label: 'tint L', light: 0.57, dark: 0.63, neutral: { light: 0.55 }, ...v3() },
      { key: 'tintScale', label: 'tint C scale', light: 1, dark: 1, neutral: { light: 3, dark: 3 }, ...v3(0, 3, 0.05) },
      { key: 'tintCap', label: 'tint C cap', light: 0.16, dark: 0.17, neutral: { light: 0.03, dark: 0.04 }, ...v3(0, 0.4) },
      { key: 'bgAlpha', label: 'fill α %', light: 10, dark: 20, ...pct },
      { key: 'borderAlpha', label: 'border α %', light: 15, dark: 25, ...pct },
      { key: 'edgeAlpha', label: 'edge α %', light: 20, dark: 30, ...pct },
      { key: 'textA', label: 'label α %', light: 82, dark: 80, ...pct },
    ],
    groups: [
      { label: 'Primary', keys: ['solidMin', 'solidMax', 'solidScale', 'solidCap', 'flip'], note: 'Solid fill; the label is white or dark by the fill’s lightness.' },
      { label: 'Secondary', keys: ['tintL', 'tintScale', 'tintCap', 'bgAlpha', 'borderAlpha'] },
      { label: 'Tertiary', keys: ['edgeAlpha'], note: 'Outline alpha; the edge color is --text-2.' },
      { label: 'Label', keys: ['textA'], note: 'Label = --text-2 at this alpha, matching --text-3. Raise for small-text contrast.' },
    ],
    css: (sel, seed, v) => `${sel} {
  --tag-tint:     oklch(from ${seed} ${v.tintL} min(calc(c * ${v.tintScale}), ${v.tintCap}) h);
  --tag-bg-solid: ${within(seed, v.solidMin, v.solidMax, v.solidScale, v.solidCap)};
  --tag-edge:     var(--text-2);
  --tag-text:     color-mix(in oklch, var(--text-2) ${v.textA}%, transparent);
  --_tag-bg-alpha:     ${v.bgAlpha}%;
  --_tag-border-alpha: ${v.borderAlpha}%;
  --_tag-edge-alpha:   ${v.edgeAlpha}%;
}
${sel}[priority="primary"] { --tag-text: ${onSolid('var(--tag-bg-solid)', v.flip)}; }`,
  },

  {
    id: 'tabs',
    title: 'Tabs',
    blurb:
      'The strip’s primary/secondary/tertiary differ structurally (filled track vs subtle vs underline). Labels and rings are the role scale: selected/hover = --text-1, rest = --text-2 at the rest α (80 → --text-3), tertiary hover = --text-2, track ring = --border-4, selected ring = --border-2, selected pill = --bg-1. Only the recessed track tint, secondary fill, and the rest α are the Tabs’ own — the knobs below.',
    vars: [
      { key: 'trackL', label: 'fill L', light: 0.55, dark: 0.8, ...v3() },
      { key: 'trackC', label: 'fill C', light: 0.14, dark: 0.12, ...v3(0, 0.4) },
      { key: 'trackA', label: 'track α', light: 0.06, dark: 0.07, ...v3() },
      { key: 'secA', label: 'fill α', light: 0.03, dark: 0.08, ...v3() },
      { key: 'restA', label: 'rest α %', light: 80, dark: 80, ...pct },
    ],
    groups: [
      { label: 'Track & fill', keys: ['trackL', 'trackC', 'trackA', 'secA'], note: 'The recessed track tint (primary) and the selected secondary fill — a faint overlay of the source hue.' },
      { label: 'Rest label', keys: ['restA'], note: 'Non-selected label = --text-2 at this alpha (80 → --text-3). Selected/hover use full --text-1.' },
    ],
    css: (sel, seed, v) => `${sel} {
  --tab-selected-text: var(--text-1);
  --tab-text-2: var(--text-2);
  --tab-rest-tone: color-mix(in oklch, var(--text-2) ${v.restA}%, transparent);
  --tabs-track-border: var(--border-4);
  --tab-selected-border: var(--border-2);
  --tabs-track-bg: oklch(from ${seed} ${v.trackL} ${v.trackC} h / ${v.trackA});
  --tab-secondary-bg: oklch(from ${seed} ${v.trackL} ${v.trackC} h / ${v.secA});
}`,
  },

  {
    id: 'checkbox',
    title: 'Checkboxes',
    blurb:
      'The checked fill takes the seed’s lightness inside a window and its chroma, scaled and capped. Hover and active shift that lightness, and the checkmark turns dark above the flip point. In all scope, the off-state box border ramps off a pinned-lightness version of the tone mixed toward neutral grey; selected scope keeps it neutral. Neutral closes the window to one lightness.',
    vars: [
      { key: 'solidMin', label: 'fill L min', light: 0.42, dark: 0.38, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'solidMax', label: 'fill L max', light: 0.85, dark: 0.8, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'solidHover', label: 'hover L shift', light: -0.05, dark: 0.04, neutral: { light: -0.15, dark: 0.03 }, ...v3(-0.3, 0.3) },
      { key: 'solidActive', label: 'active L shift', light: -0.1, dark: 0.08, neutral: { light: -0.2, dark: 0.08 }, ...v3(-0.3, 0.3) },
      { key: 'solidScale', label: 'fill C scale', light: 1, dark: 0.9, neutral: { light: 1, dark: 1 }, ...v3(0, 2, 0.05), tip: 'Multiplies the seed’s chroma.' },
      { key: 'solidCap', label: 'fill C cap', light: 0.22, dark: 0.2, neutral: { light: 0.4, dark: 0.4 }, ...v3(0, 0.4) },
      { key: 'flip', label: 'checkmark flip L', light: 0.72, dark: 0.72, ...v3(), tip: 'The checkmark is light on a fill darker than this and dark on a lighter one.' },
      { key: 'markL', label: 'checkmark L', light: 0.97, dark: 0.97, neutral: { dark: 0.935 }, ...v3(), tip: 'Lightness of the checkmark on a fill darker than the flip point.' },
    ],
    groups: [{ label: 'Fill', keys: ['solidMin', 'solidMax', 'solidHover', 'solidActive', 'solidScale', 'solidCap', 'flip', 'markL'] }],
    css: (sel, seed, v) => `${sel} {
  --checkbox-bg-selected: ${within(seed, v.solidMin, v.solidMax, v.solidScale, v.solidCap)};
  --checkbox-bg-selected-hover: ${shift('var(--checkbox-bg-selected)', v.solidHover)};
  --checkbox-bg-selected-active: ${shift('var(--checkbox-bg-selected)', v.solidActive)};
  --checkbox-icon: ${onSolid('var(--checkbox-bg-selected)', v.flip, v.markL)};
}`,
  },

  {
    id: 'radio',
    title: 'Radio',
    blurb:
      'Identical fill formula to Checkbox: the selected mark takes the seed’s lightness inside a window, and the dot turns dark above the flip point. All scope also ramps the off-ring border from a pinned-lightness version of the tone; selected scope keeps unpicked options neutral.',
    vars: [
      { key: 'solidMin', label: 'fill L min', light: 0.42, dark: 0.38, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'solidMax', label: 'fill L max', light: 0.85, dark: 0.8, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'solidHover', label: 'hover L shift', light: -0.05, dark: 0.04, neutral: { light: -0.15, dark: 0.03 }, ...v3(-0.3, 0.3) },
      { key: 'solidActive', label: 'active L shift', light: -0.1, dark: 0.08, neutral: { light: -0.2, dark: 0.08 }, ...v3(-0.3, 0.3) },
      { key: 'solidScale', label: 'fill C scale', light: 1, dark: 0.9, neutral: { light: 1, dark: 1 }, ...v3(0, 2, 0.05), tip: 'Multiplies the seed’s chroma.' },
      { key: 'solidCap', label: 'fill C cap', light: 0.22, dark: 0.2, neutral: { light: 0.4, dark: 0.4 }, ...v3(0, 0.4) },
      { key: 'flip', label: 'dot flip L', light: 0.72, dark: 0.72, ...v3(), tip: 'The dot is light on a fill darker than this and dark on a lighter one.' },
      { key: 'markL', label: 'dot L', light: 0.97, dark: 0.97, neutral: { dark: 0.935 }, ...v3(), tip: 'Lightness of the dot on a fill darker than the flip point.' },
    ],
    groups: [{ label: 'Fill', keys: ['solidMin', 'solidMax', 'solidHover', 'solidActive', 'solidScale', 'solidCap', 'flip', 'markL'] }],
    css: (sel, seed, v) => `${sel} {
  --radio-bg-selected: ${within(seed, v.solidMin, v.solidMax, v.solidScale, v.solidCap)};
  --radio-bg-selected-hover: ${shift('var(--radio-bg-selected)', v.solidHover)};
  --radio-bg-selected-active: ${shift('var(--radio-bg-selected)', v.solidActive)};
  --radio-dot: ${onSolid('var(--radio-bg-selected)', v.flip, v.markL)};
}`,
  },

  {
    id: 'expander',
    title: 'Expander',
    blurb:
      'Every color is a role token; the Expander defines none of its own. Label: rest --text-2, hover --text-1 (Title’s secondary/primary). Fill and border are the surface scale (secondary --bg-2 / --border-5, primary --bg-4 / --border-4), and the fill lightens a step on hover. Tertiary is text only, all themed per tone.',
    // The Expander has no colors of its own — every output is a role token, so
    // there are no knobs. It follows the Text and Background & Borders specs live.
    vars: [],
    groups: [],
    css: (sel) => `${sel} {
  --expander-text: var(--text-2);
  --expander-text-hover: var(--text-1);
  --expander-bg-secondary: var(--bg-2);
  --expander-border-secondary: var(--border-5);
  --expander-bg-primary: var(--bg-4);
  --expander-border-primary: var(--border-4);
}`,
  },

  {
    id: 'input',
    title: 'Input',
    blurb:
      'One border color from the seed hue at a tunable L/C — the goal is a single L/C per theme that works across every tone. Hover thickens the edge 0.5→1px (no recolor). Neutral overrides pin it grey (≈ --border-2). Applies to Input and the InputDate trigger (both compose <a-input>).',
    vars: [
      { key: 'borderL', label: 'border L', light: 0.58, dark: 0.52, neutral: { light: 0.8, dark: 0.4 }, ...v3() },
      { key: 'borderC', label: 'border C', light: 0.18, dark: 0.15, neutral: { light: 0.015, dark: 0.019 }, ...v3(0, 0.4) },
    ],
    groups: [{ label: 'Border', keys: ['borderL', 'borderC'], note: 'Seed hue at this L/C (hover thickens the edge, no recolor). Toned starts at the average of today’s per-status literals; neutral pins grey ≈ --border-2.' }],
    css: (sel, seed, v) => `${sel} {
  --input-border: ${ok(seed, v.borderL, v.borderC)};
}`,
  },

  {
    id: 'menuitem',
    title: 'Menu items',
    blurb:
      'The item label is --text-2; the hint and icon are --text-2 at the hint α (80 → --text-3), so the text follows the Text spec while the hint strength stays tunable. The selected row holds a persistent tint of the label color — its alpha is the Menu’s own knob too.',
    vars: [
      { key: 'hintA', label: 'hint α %', light: 80, dark: 80, ...pct },
      { key: 'selectedA', label: 'selected α %', light: 9, dark: 12, ...pct },
    ],
    groups: [
      { label: 'Text', keys: ['hintA'], note: 'Label is full --text-2; hint + icon are --text-2 at this alpha (80 → --text-3).' },
      { label: 'Selected', keys: ['selectedA'], note: 'Tint held on the selected row — a % of the item color (--text-2).' },
    ],
    css: (sel, _seed, v) => `${sel} {
  --menu-item-color: var(--text-2);
  --menu-item-hint-color: color-mix(in oklch, var(--text-2) ${v.hintA}%, transparent);
  --menu-item-icon-color: var(--menu-item-hint-color);
  --menu-item-selected: ${v.selectedA}%;
}`,
  },

  {
    id: 'progress',
    title: 'Progress',
    blurb:
      'Every color is a role token; Progress defines none of its own. Track = --bg-4, border = --border-4, the fill indicator = --bg-5, the label = --text-2, and the right-aligned hint = --text-3. Named tones swap in the matching -{tone} role variant (so dark mode is free), and the fill’s right-edge fades from --bg-5 to --border-4. Follows the Text and Background & Borders panels live.',
    // Like the Expander, Progress has no colors of its own — every output is a
    // role token, so there are no knobs. It tracks the Text + Surface specs.
    vars: [],
    groups: [],
    css: (sel) => `${sel} {
  --progress-bg: var(--bg-4);
  --progress-border-color: var(--border-4);
  --progress-indicator-bg: var(--bg-5);
  --progress-text-color: var(--text-2);
  --progress-hint-color: var(--text-3);
}`,
  },
]

/** Element selector each spec's `css()` targets (bare, no container prefix). */
export const EL_SELECTOR: Record<string, string> = {
  surface: '.tl-surface-swatch',
  text: 'a-text',
  button: 'a-button',
  tag: 'a-tag',
  tabs: 'a-tabs',
  checkbox: 'a-checkbox',
  radio: 'a-radio',
  expander: 'a-expander',
  input: 'a-input',
  menuitem: 'a-menu-item',
  progress: 'a-progress',
}

/** Resolve a spec's display groups to their `VarDef`s (a key may repeat across groups). */
export const groupsOf = (spec: ComponentSpec): { label: string; note?: string; vars: VarDef[] }[] => {
  const byKey = new Map(spec.vars.map((d) => [d.key, d]))
  return spec.groups.map((g) => ({
    label: g.label,
    note: g.note,
    vars: g.keys.map((k) => byKey.get(k)!).filter(Boolean),
  }))
}

/**
 * Initial values for a spec at a theme and tone. Neutral is not a formula-derived
 * tone in Anta (it's hand-authored grey), and a fixed chroma over a near-grey seed
 * reads as an over-saturated tint. So for the Neutral panel every chroma constant
 * (the `…C` keys — pinned chroma, not the `chromaScale` multiplier on the source)
 * starts near zero, making the generative side read as the intended neutral grey.
 * The inputs stay editable, so bumping a chroma shows how the tint would grow.
 */
const NEUTRAL_CHROMA = 0.008
export const defaults = (spec: ComponentSpec, dark: boolean, tone?: Tone): Vals =>
  Object.fromEntries(
    spec.vars.map((d) => {
      const base = dark ? d.dark : d.light
      if (tone === 'neutral') {
        // A per-key neutral override wins outright; else chroma keys fall back to
        // the flat near-grey so a fixed chroma doesn't over-saturate the seed.
        const override = dark ? d.neutral?.dark : d.neutral?.light
        if (override != null) return [d.key, override]
        if (d.key.endsWith('C')) return [d.key, NEUTRAL_CHROMA]
      }
      return [d.key, base]
    }),
  )
