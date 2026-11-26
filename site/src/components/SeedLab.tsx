import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import chroma from 'chroma-js'
import { Banner, Button, Checkbox, Progress, RadioGroup, Slider, Switch, Tag, Text, Title } from '@antadesign/anta'
import ColorPicker from './ColorPicker'
import styles from './SeedLab.module.css'

/**
 * Seed lab. Anta's colored tones follow their seed's lightness and chroma within
 * limits. This page shows what those limits do and compares the result with
 * the hue-only derivation that shipped through 0.3.39.
 *
 * Each panel sets `--anta-seed-brand` to the picked seed and renders brand-toned
 * components twice. "Now" is the shipped result. "Before" overrides it with the
 * earlier fixed-lightness formulas, kept in `LEGACY`.
 *
 * Roles fall into three classes:
 * - Solid fills take the seed's lightness inside a wide window. The label on
 *   top switches between white and dark at the flip point.
 * - Text-like foregrounds take the seed's lightness inside a narrow window,
 *   bounded by the surface behind them.
 * - Tinted backgrounds and borders keep a pinned lightness.
 * Every chroma is the seed's own, scaled and capped.
 *
 * Three limits are design choices with no correct value. The page exposes them
 * as sliders that set the library's `--anta-solid-*`, `--anta-on-solid-flip`,
 * and `--anta-fg-*` variables on the panel, and reports the worst contrast each
 * setting allows across all hues.
 */

type Scheme = 'light' | 'dark'

/** The limits this page reads or changes. Defaults mirror `src/tokens.css`. */
interface Limits {
  /** `--anta-solid-l-min` and `--anta-solid-l-max`. */
  solid: [number, number]
  /** `--anta-solid-c-scale` and `--anta-solid-c-max`. */
  solidChroma: { scale: number; cap: number }
  /** `--anta-on-solid-flip`. The label is white on a fill darker than this, and
   *  dark on a lighter one. 0.72 is where APCA rates the two labels equal,
   *  within 0.03 across hues. WCAG 2 puts that point near 0.58, so a white
   *  label on a fill between the two is below 4.5:1. */
  flip: number
  /** Lightness of the dark label. */
  onLight: number
  /** `--anta-fg-l-min` and `--anta-fg-l-max`. */
  fg: [number, number]
  /** `--anta-fg-c-max`. */
  fgChromaCap: number
  /** Lightness and highest chroma of `--bg-5-{tone}`, the most tinted surface. */
  tintedSurface: [number, number]
}

const LIMITS: Record<Scheme, Limits> = {
  light: {
    solid: [0.42, 0.85],
    solidChroma: { scale: 1, cap: 0.22 },
    flip: 0.72,
    onLight: 0.15,
    fg: [0.3, 0.46],
    fgChromaCap: 0.17,
    tintedSurface: [0.935, 0.0375],
  },
  dark: {
    solid: [0.38, 0.8],
    solidChroma: { scale: 0.9, cap: 0.2 },
    flip: 0.72,
    onLight: 0.15,
    fg: [0.86, 0.92],
    fgChromaCap: 0.13,
    tintedSurface: [0.205, 0.0688],
  },
}

/** The fixed lightness and chroma each role used through 0.3.39. */
interface Legacy {
  /** `[lightness, chroma]` of `--text-1` and `--text-2`. */
  text: [[number, number], [number, number]]
  /** Alpha of `--text-3`, `--text-4`, and `--text-5` over `--text-2`, in percent. */
  textAlpha: [number, number, number]
  /** `[lightness, chroma]` of `--bg-2…5-{tone}` and `--border-1…5-{tone}`. */
  bg: [number, number][]
  border: [number, number][]
  button: {
    /** Fill lightness at rest, hover, and active, then chroma. */
    fill: [number, number, number, number]
    /** Foreground lightness at rest, on hover, on quaternary hover, then chroma. */
    fg: [number, number, number, number]
    /** Tint lightness and chroma, then alpha at rest, hover, and active. */
    tint: [number, number, number, number, number]
  }
  /** Checkbox and Radio fill lightness at rest, hover, and active. */
  mark: [number, number, number]
  markIcon: string
  /** Switch track lightness at rest, hover, and active. */
  track: [number, number, number]
  thumb: string
  /** `[lightness, chroma]` of the Tag tint and solid fill. */
  tag: [[number, number], [number, number]]
}

const LEGACY: Record<Scheme, Legacy> = {
  light: {
    text: [[0.38, 0.11], [0.43, 0.15]],
    textAlpha: [82, 66, 40],
    bg: [[0.99, 0.004], [0.972, 0.011], [0.955, 0.02], [0.935, 0.03]],
    border: [[0.67, 0.13], [0.8, 0.09], [0.86, 0.055], [0.9, 0.04], [0.935, 0.028]],
    button: { fill: [0.51, 0.46, 0.41, 0.17], fg: [0.46, 0.4, 0.38, 0.17], tint: [0.54, 0.17, 0.1, 0.15, 0.2] },
    mark: [0.5, 0.45, 0.4],
    markIcon: '#f6f4f6',
    track: [0.56, 0.48, 0.42],
    thumb: 'var(--bg-1)',
    tag: [[0.57, 0.16], [0.58, 0.175]],
  },
  dark: {
    text: [[0.85, 0.1], [0.77, 0.11]],
    textAlpha: [80, 62, 40],
    bg: [[0.13, 0.02], [0.17, 0.035], [0.185, 0.05], [0.205, 0.055]],
    border: [[0.52, 0.15], [0.41, 0.12], [0.33, 0.09], [0.26, 0.06], [0.21, 0.045]],
    button: { fill: [0.4, 0.44, 0.48, 0.16], fg: [0.86, 0.86, 0.9, 0.13], tint: [0.58, 0.16, 0.215, 0.29, 0.34] },
    mark: [0.45, 0.5, 0.57],
    markIcon: '#ece9ec',
    track: [0.47, 0.53, 0.58],
    thumb: '#ece9ec',
    tag: [[0.63, 0.17], [0.46, 0.165]],
  },
}

const PRESETS = [
  { label: 'Anta brand', seed: '#5f4bc3' },
  { label: 'Warning', seed: '#c37416' },
  { label: 'Teal', seed: '#0f766e' },
  { label: 'Yellow', seed: '#fde047' },
  { label: 'Pastel', seed: '#c4b5fd' },
  { label: 'Navy', seed: '#1e2a5a' },
  { label: 'Grey', seed: '#635b65' },
  { label: 'Black', seed: '#000000' },
]

const PRIORITIES = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

/**
 * The hue-only derivation for one scheme. `scope` is a container selector. The
 * brand role tokens are set on it; the component rules restore each element's
 * earlier formulas.
 */
function legacyCss(scope: string, seed: string, k: Legacy) {
  const at = (l: number, c: number | string, alpha?: number) =>
    `oklch(from ${seed} ${l} ${c} h${alpha == null ? '' : ` / ${alpha}`})`
  const [fillRest, fillHover, fillActive, fillC] = k.button.fill
  const [fgRest, fgHover, fgQuaternary, fgC] = k.button.fg
  const [tintL, tintC, tintRest, tintHover, tintActive] = k.button.tint
  return `${scope} {
  --text-1-brand: ${at(...k.text[0])};
  --text-2-brand: ${at(...k.text[1])};
  --text-3-brand: color-mix(in oklch, var(--text-2-brand) ${k.textAlpha[0]}%, transparent);
  --text-4-brand: color-mix(in oklch, var(--text-2-brand) ${k.textAlpha[1]}%, transparent);
  --text-5-brand: color-mix(in oklch, var(--text-2-brand) ${k.textAlpha[2]}%, transparent);

${k.bg.map((v, i) => `  --bg-${i + 2}-brand: ${at(...v)};`).join('\n')}
${k.border.map((v, i) => `  --border-${i + 1}-brand: ${at(...v)};`).join('\n')}
}
${scope} a-button {
  --button-bg-primary-rest: ${at(fillRest, fillC)};
  --button-bg-primary-hover: ${at(fillHover, fillC)};
  --button-bg-primary-active: ${at(fillActive, fillC)};
  --button-fg-primary-rest: #ffffff;

  --button-fg-secondary-rest: ${at(fgRest, fgC)};
  --button-fg-secondary-hover: ${at(fgHover, fgC)};
  --button-fg-quaternary-rest: ${at(fgRest, fgC, 0.85)};
  --button-fg-quaternary-hover: ${at(fgQuaternary, fgC)};

  --button-bg-secondary-rest: ${at(tintL, tintC, tintRest)};
  --button-bg-secondary-hover: ${at(tintL, tintC, tintHover)};
  --button-bg-secondary-active: ${at(tintL, tintC, tintActive)};
  --button-bg-tertiary-hover: ${at(tintL, tintC, tintRest)};
  --button-bg-tertiary-active: ${at(tintL, tintC, tintHover)};
}
${scope} a-checkbox {
  --checkbox-bg-selected: ${at(k.mark[0], 'c')};
  --checkbox-bg-selected-hover: ${at(k.mark[1], 'c')};
  --checkbox-bg-selected-active: ${at(k.mark[2], 'c')};
  --checkbox-icon: ${k.markIcon};
}
${scope} a-radio {
  --radio-bg-selected: ${at(k.mark[0], 'c')};
  --radio-bg-selected-hover: ${at(k.mark[1], 'c')};
  --radio-bg-selected-active: ${at(k.mark[2], 'c')};
  --radio-dot: ${k.markIcon};
}
${scope} a-switch {
  --switch-track-on: ${at(k.track[0], 'c')};
  --switch-track-on-hover: ${at(k.track[1], 'c')};
  --switch-track-on-active: ${at(k.track[2], 'c')};
  --switch-thumb: ${k.thumb};
}
${scope} a-tag {
  --tag-tint: ${at(...k.tag[0])};
  --tag-bg-solid: ${at(...k.tag[1])};
}
${scope} a-tag[priority="primary"] {
  --tag-text: #fff;
}`
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))
const fmt = (n: number) => n.toFixed(2)

/** The seed in OKLCH. A grey has no hue, which chroma-js reports as NaN. */
function seedOklch(seed: string): [number, number, number] {
  try {
    const [l, c, h] = chroma(seed).oklch()
    return [l, c, Number.isNaN(h) ? 0 : h]
  } catch {
    return [0.5, 0, 0]
  }
}

interface StripProps {
  title: string
  seed: string
  seedL: number
  window: [number, number]
  /** Draws the label threshold when set. */
  flip?: number
  summary: string
}

/** A lightness axis with the allowed window, the seed, and the value in use. */
function Strip({ title, seed, seedL, window: [min, max], flip, summary }: StripProps) {
  const used = clamp(min, seedL, max)
  const pct = (l: number) => `${l * 100}%`
  return (
    <div className={styles.strip}>
      <div className={styles.stripHead}>
        <span className={styles.stripTitle}>{title}</span>
        <span className={styles.stripSummary}>{summary}</span>
      </div>
      <div className={styles.axis}>
        <div className={styles.marker} style={{ left: pct(seedL) }}>
          <span>seed {fmt(seedL)}</span>
          <i />
        </div>
        <div
          className={styles.track}
          style={{
            background: `linear-gradient(to right in oklch, oklch(from ${seed} 0 min(c, 0.2) h), oklch(from ${seed} 1 min(c, 0.2) h))`,
          }}
        >
          <div className={styles.outside} style={{ left: 0, width: pct(min) }} />
          <div className={styles.outside} style={{ left: pct(max), right: 0 }} />
          <div className={styles.window} style={{ left: pct(min), width: pct(max - min) }} />
          {flip != null ? <div className={styles.flip} style={{ left: pct(flip) }} /> : null}
        </div>
        <div className={`${styles.marker} ${styles.below}`} style={{ left: pct(used) }}>
          <i />
          <span>used {fmt(used)}</span>
        </div>
      </div>
      <div className={styles.legend}>
        <span>
          allowed {fmt(min)} to {fmt(max)}
        </span>
        {flip != null ? <span>dashed line: label turns dark above {fmt(flip)}</span> : null}
      </div>
    </div>
  )
}

/** One foreground and background pair under both contrast models. */
interface Contrast {
  /** WCAG 2 ratio. */
  wcag: number
  /** APCA lightness contrast, as a magnitude. */
  apca: number
}

type Rgb = number[]

const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// APCA 0.0.98G-4g, the constants published for sRGB.
const apcaY = (c: Rgb) => {
  const [r, g, b] = c.map((v) => (v / 255) ** 2.4)
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y
}

/** Contrast of two 8-bit sRGB colors. */
function contrastOf(fg: Rgb, bg: Rgb): Contrast {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  const [ty, by] = [apcaY(fg), apcaY(bg)]
  const sapc = by > ty ? (by ** 0.56 - ty ** 0.57) * 1.14 : (by ** 0.65 - ty ** 0.62) * 1.14
  return {
    wcag: (hi + 0.05) / (lo + 0.05),
    apca: Math.abs(sapc) < 0.1 ? 0 : (Math.abs(sapc) - 0.027) * 100,
  }
}

/** OKLCH to 8-bit sRGB. Out-of-gamut colors lose chroma until they fit, which
 *  keeps lightness and hue as CSS gamut mapping intends. */
function oklchToRgb(l: number, c: number, h: number): Rgb {
  const linear = (chromaValue: number) => {
    const a = chromaValue * Math.cos((h * Math.PI) / 180)
    const b = chromaValue * Math.sin((h * Math.PI) / 180)
    const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
    return [
      4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
      -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
      -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
    ]
  }
  let fit = c
  let rgb = linear(fit)
  while (fit > 0 && rgb.some((v) => v < -0.0005 || v > 1.0005)) {
    fit = Math.max(0, fit - 0.004)
    rgb = linear(fit)
  }
  return rgb.map((v) => {
    const x = Math.min(1, Math.max(0, v))
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  })
}

/** The lowest contrast `pair` produces over every hue and a range of chroma. */
function weakest(cap: number, pair: (c: number, h: number) => [fg: Rgb, bg: Rgb]): Contrast {
  const worst = { wcag: Infinity, apca: Infinity }
  for (let h = 0; h < 360; h += 4) {
    for (let step = 0; step <= 6; step++) {
      const result = contrastOf(...pair((cap * step) / 6, h))
      worst.wcag = Math.min(worst.wcag, result.wcag)
      worst.apca = Math.min(worst.apca, result.apca)
    }
  }
  return worst
}

/** What the current limits allow at their worst, for any seed. */
function consequences(scheme: Scheme, k: Limits) {
  const page = oklchToRgb(scheme === 'light' ? 1 : 0, 0, 0)
  const white = oklchToRgb(1, 0, 0)
  const dark = oklchToRgb(k.onLight, 0, 0)
  // The fill nearest the page in lightness is the hardest to tell from it.
  const nearPage = scheme === 'light' ? k.solid[1] : k.solid[0]
  const shape = weakest(k.solidChroma.cap, (c, h) => [oklchToRgb(nearPage, c, h), page])
  // A label is weakest on the lightest fill that still takes white and on the
  // darkest one that takes dark. Both sit at the flip point when it is inside
  // the window.
  const whiteAt = clamp(k.solid[0], k.flip, k.solid[1])
  const label = [
    k.flip > k.solid[0] ? weakest(k.solidChroma.cap, (c, h) => [white, oklchToRgb(whiteAt, c, h)]) : null,
    k.flip < k.solid[1] ? weakest(k.solidChroma.cap, (c, h) => [dark, oklchToRgb(whiteAt, c, h)]) : null,
  ].filter((v): v is Contrast => v != null)
  // Text is weakest at the window end nearest the surface, over the most
  // tinted background of its own tone.
  const nearSurface = scheme === 'light' ? k.fg[1] : k.fg[0]
  const [bgL, bgC] = k.tintedSurface
  const text = weakest(k.fgChromaCap, (c, h) => [
    oklchToRgb(nearSurface, c, h),
    oklchToRgb(bgL, bgC, h),
  ])
  return {
    shape,
    label: { wcag: Math.min(...label.map((v) => v.wcag)), apca: Math.min(...label.map((v) => v.apca)) },
    text,
  }
}

interface Measured {
  label: Contrast
  text: Contrast
  body: Contrast
}

/** WCAG 2 and APCA contrast read from the rendered samples of one column. */
function measure(column: HTMLElement, page: string): Measured | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const rgb = (color: string) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
  }
  const contrast = (fg: string, bg: string) => contrastOf(rgb(fg), rgb(bg))
  const primary = column.querySelector<HTMLElement>('a-button[priority="primary"]')
  const tertiary = column.querySelector<HTMLElement>('a-button[priority="tertiary"]')
  const body = column.querySelector<HTMLElement>('a-text[priority="secondary"]')
  if (!primary || !tertiary || !body) return null
  const p = getComputedStyle(primary)
  return {
    label: contrast(p.color, p.backgroundColor),
    text: contrast(getComputedStyle(tertiary).color, page),
    body: contrast(getComputedStyle(body).color, page),
  }
}

/** A subjective limit: its slider, what it trades off, and the worst case the
 *  current setting allows. */
function Knob({
  children,
  consequence,
  fails,
  note,
}: {
  children: ComponentChildren
  consequence: string
  fails?: boolean
  note: string
}) {
  return (
    <div className={styles.knob}>
      {children}
      <span className={`${styles.consequence} ${fails ? styles.fails : ''}`}>{consequence}</span>
      <span className={styles.knobNote}>{note}</span>
    </div>
  )
}

function Ratio({ name, value }: { name: string; value?: Contrast }) {
  if (value == null) return <span className={styles.ratio}>{name} …</span>
  const fails = value.wcag < 4.5
  return (
    <span className={`${styles.ratio} ${fails ? styles.fails : ''}`}>
      {name} {value.wcag.toFixed(1)}:1{fails ? ' (below WCAG 4.5)' : ''}, APCA {value.apca.toFixed(0)}
    </span>
  )
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      {children}
    </div>
  )
}

interface PanelProps {
  scheme: Scheme
  seed: string
  k: Limits
  onChange: (patch: Partial<Limits>) => void
}

function Panel({ scheme, seed, k, onChange }: PanelProps) {
  const worst = useMemo(() => consequences(scheme, k), [scheme, k])
  const light = scheme === 'light'
  const [l, c] = seedOklch(seed)
  const solidL = clamp(k.solid[0], l, k.solid[1])
  const solidC = Math.min(c * k.solidChroma.scale, k.solidChroma.cap)
  const fgL = clamp(k.fg[0], l, k.fg[1])
  const scope = `seedlab-before-${scheme}`

  const ref = useRef<HTMLDivElement>(null)
  const [ratios, setRatios] = useState<Record<string, Measured | null>>({})
  useEffect(() => {
    // Button colors transition, so read them once they have settled.
    const timer = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const page = getComputedStyle(el).backgroundColor
      setRatios(
        Object.fromEntries(
          Array.from(el.querySelectorAll<HTMLElement>('[data-column]')).map((col) => [
            col.dataset.column,
            measure(col, page),
          ]),
        ),
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [seed, k])

  const how = (from: number, to: number) =>
    to === from ? 'seed lightness kept' : to > from ? `raised to ${fmt(to)}` : `lowered to ${fmt(to)}`

  return (
    <section
      ref={ref}
      className={`${scheme} ${styles.panel}`}
      style={{
        '--anta-seed-brand': seed,
        '--anta-solid-l-min': k.solid[0],
        '--anta-solid-l-max': k.solid[1],
        '--anta-on-solid-flip': k.flip,
        '--anta-fg-l-min': k.fg[0],
        '--anta-fg-l-max': k.fg[1],
      }}
    >
      <Title level={4}>{scheme === 'light' ? 'Light' : 'Dark'}</Title>

      <div className={styles.role}>
        <Strip
          title="Solid fill"
          seed={seed}
          seedL={l}
          window={k.solid}
          flip={k.flip}
          summary={`${how(l, solidL)}, ${solidL < k.flip ? 'white' : 'dark'} label, chroma ${fmt(c)} to ${fmt(solidC)}`}
        />
        <Knob
          note={
            light
              ? 'A higher upper end keeps more of a light brand color. A lower one makes the button stand out more from the page.'
              : 'A lower bottom end keeps more of a dark brand color. A higher one makes the button stand out more from the page.'
          }
          consequence={`Weakest fill against the page: ${worst.shape.wcag.toFixed(1)}:1`}
        >
          <Slider
            label="Allowed fill lightness"
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={k.solid}
            onValueChange={(_e, { value }) => onChange({ solid: value as [number, number] })}
          />
        </Knob>
        <Knob
          note="Where the label switches from white to dark. APCA rates the two labels equal near 0.72. WCAG 2 puts that point near 0.58."
          consequence={`Weakest label on a fill: ${worst.label.wcag.toFixed(1)}:1, APCA ${worst.label.apca.toFixed(0)}`}
        >
          <Slider
            label="Label turns dark above"
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={k.flip}
            markers={[
              { value: 0.58, label: 'WCAG 2' },
              { value: 0.72, label: 'APCA' },
            ]}
            onValueChange={(_e, { value }) => onChange({ flip: value as number })}
          />
        </Knob>
      </div>

      <div className={styles.role}>
        <Strip title="Text on a surface" seed={seed} seedL={l} window={k.fg} summary={how(l, fgL)} />
        <Knob
          note={
            light
              ? 'The upper end decides contrast with the surface. The lower end decides how dark toned text may get.'
              : 'The lower end decides contrast with the surface. The upper end decides how light toned text may get.'
          }
          consequence={`Weakest text on the most tinted background: ${worst.text.wcag.toFixed(1)}:1${worst.text.wcag < 4.5 ? ' (below WCAG 4.5)' : ''}`}
          fails={worst.text.wcag < 4.5}
        >
          <Slider
            label="Allowed text lightness"
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={k.fg}
            onValueChange={(_e, { value }) => onChange({ fg: value as [number, number] })}
          />
        </Knob>
      </div>

      <div className={styles.columns}>
        {(['before', 'now'] as const).map((mode) => (
          <div key={mode} data-column={mode} className={`${styles.column} ${mode === 'before' ? scope : ''}`}>
            <p className={styles.columnTitle}>{mode === 'before' ? 'Before: hue only' : 'Now'}</p>

            <Group title="Button">
              <div className={styles.row}>
                {PRIORITIES.map((p) => (
                  // priority is a discriminated union on Button; the value is dynamic here.
                  <Button key={p} priority={p as any} tone="brand" label={p} />
                ))}
              </div>
            </Group>

            <Group title="Checkbox, Radio, Switch">
              <div className={styles.row}>
                <Checkbox defaultChecked tone="brand" toneScope="selected" label="Checked" />
                <Switch defaultChecked tone="brand" toneScope="selected" label="On" />
              </div>
              <RadioGroup
                name={`seedlab-${scheme}-${mode}`}
                tone="brand"
                toneScope="selected"
                defaultValue="b"
                options={[
                  { value: 'a', label: 'One' },
                  { value: 'b', label: 'Two' },
                ]}
              />
            </Group>

            <Group title="Tag">
              <div className={styles.row}>
                {(['primary', 'secondary', 'tertiary'] as const).map((p) => (
                  <Tag key={p} priority={p} tone="brand">
                    {p}
                  </Tag>
                ))}
              </div>
            </Group>

            <Group title="Title and Text">
              <Title level={4} tone="brand">
                Primary title
              </Title>
              {PRIORITIES.map((p) => (
                <Text key={p} priority={p} tone="brand">
                  {p} text
                </Text>
              ))}
            </Group>

            <Group title="Banner and Progress">
              <Banner tone="brand" message="A new release is available." />
              <Progress value={60} tone="brand" label="Uploading" hint="3 of 5" />
            </Group>

            <p className={styles.ratios}>
              <Ratio name="primary button label" value={ratios[mode]?.label} />
              <Ratio name="tertiary button text" value={ratios[mode]?.text} />
              <Ratio name="secondary text" value={ratios[mode]?.body} />
            </p>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: legacyCss(`.${scope}`, seed, LEGACY[scheme]) }} />
    </section>
  )
}

export default function SeedLab() {
  const [seed, setSeed] = useState(PRESETS[0].seed)
  // ColorPicker reads `value` only at mount, so a preset remounts it.
  const [pickerRev, setPickerRev] = useState(0)
  const [l, c, h] = seedOklch(seed)
  const [limits, setLimits] = useState(LIMITS)
  const patch = (scheme: Scheme) => (change: Partial<Limits>) =>
    setLimits((all) => ({ ...all, [scheme]: { ...all[scheme], ...change } }))

  return (
    <div className={styles.lab}>
      <header className={styles.header}>
        <Title level={1}>Seed lab</Title>
        <Text priority="secondary">
          Anta derives each colored tone from a seed color. The seed’s lightness and chroma come through within
          limits. Solid fills follow the seed’s lightness inside a wide window, and the label or mark on top turns
          dark on a light fill. Text follows it inside a narrow window, so it stays readable on the surface behind
          it. Tinted backgrounds and borders keep a fixed lightness. Chroma always comes from the seed, up to a cap.
          Both columns below set the brand seed. Before shows the earlier derivation, which kept only the hue. The
          sliders are design choices; each reports the weakest contrast its setting allows for any seed.
        </Text>
      </header>

      <div className={styles.seedRow}>
        <ColorPicker
          key={pickerRev}
          value={seed}
          label="Seed"
          onChange={(hex: string) => setSeed(hex)}
        />
        <span className={styles.seedValue}>
          oklch({fmt(l)} {fmt(c)} {h.toFixed(0)})
        </span>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.seed}
              type="button"
              className={styles.preset}
              aria-pressed={p.seed === seed}
              onClick={() => {
                setSeed(p.seed)
                setPickerRev((r) => r + 1)
              }}
            >
              <i style={{ background: p.seed }} />
              {p.label}
            </button>
          ))}
        </div>
        {limits !== LIMITS ? (
          <Button size="small" priority="tertiary" label="Reset limits" onClick={() => setLimits(LIMITS)} />
        ) : null}
      </div>

      <div className={styles.panels}>
        <Panel scheme="light" seed={seed} k={limits.light} onChange={patch('light')} />
        <Panel scheme="dark" seed={seed} k={limits.dark} onChange={patch('dark')} />
      </div>
    </div>
  )
}
