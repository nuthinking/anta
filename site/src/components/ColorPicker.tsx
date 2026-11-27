import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import chroma from 'chroma-js'
import { Menu, Tabs, TabPanel, Input, InputNumber, Slider, Tooltip } from '@antadesign/anta'
import styles from './ColorPicker.module.css'

/**
 * Color picker built from Anta components. A swatch field opens a Menu holding
 * the picker: color models (HEX / RGB / HSL / OKLCH) as Anta Tabs. `defaultMode`
 * chooses the tab shown first. Every tab has a two-dimensional pad, a hue
 * Slider, and its fields as Anta Inputs. HEX and RGB share a saturation and
 * brightness pad; HSL has saturation and lightness. The OKLCH pad has chroma and
 * lightness for the current hue. Its chroma axis ends at the most sRGB can show
 * at that hue, the colors sRGB cannot show are left blank, and a pick stops at
 * their edge. `alpha` adds an opacity Slider and reports eight-digit hex for a
 * translucent color.
 * The in-gamut chroma limit lives in a Tooltip on the OKLCH C input. OKLCH
 * `[l, c, h]` is the source of truth; other models convert back via chroma-js.
 * Gamut math is done directly so the limit matches the browser.
 */

type Triple = [number, number, number]
const CMAX = 0.4
/** CSS size of a pad. The OKLCH canvas scales it by the device pixel ratio. */
const PW = 276
const PH = 150

function oklchToLinear(L: number, C: number, H: number): Triple {
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}
function inGamut(L: number, C: number, H: number): boolean {
  const [r, g, b] = oklchToLinear(L, C, H)
  const e = 0.0008
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e
}
const gamma = (c: number) => {
  c = Math.max(0, Math.min(1, c))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}
function maxChroma(L: number, H: number): number {
  // Near black every channel is within inGamut's tolerance, whatever the chroma,
  // so the tolerance shrinks with the lightness here.
  const e = Math.min(0.0008, 0.05 * L ** 3)
  const fits = (C: number) => oklchToLinear(L, C, H).every((v) => v >= -e && v <= 1 + e)
  let lo = 0
  let hi = CMAX
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2
    if (fits(m)) lo = m
    else hi = m
  }
  return lo
}
const safeOklch = (arr: number[], fh: number): Triple => [arr[0], arr[1], Number.isNaN(arr[2]) ? fh : arr[2]]
const fx = (x: number, d: number) => (Math.round(x * 10 ** d) / 10 ** d).toString()

// A channel field: drag across it to scrub, or type a number. An emptied field
// reports null, which is not a color, so the field stays blank until the next
// number or until the color changes elsewhere.
function Chan({
  label,
  value,
  min,
  max,
  step,
  onVal,
  tip,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onVal: (v: number) => void
  tip?: any
}) {
  const [blank, setBlank] = useState(false)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (blank) setBlank(false)
  }
  return (
    <div style={{ flex: '1 1 0', minWidth: 0 }}>
      <InputNumber
        size="small"
        label={label}
        min={min}
        max={max}
        step={step}
        value={blank ? null : value}
        onValueChange={(_e: any, a: any) => {
          setBlank(a.value === null)
          if (a.value !== null) onVal(a.value)
        }}
      >
        {tip ? <Tooltip>{tip}</Tooltip> : null}
      </InputNumber>
    </div>
  )
}

export type ColorPickerMode = 'hex' | 'rgb' | 'hsl' | 'oklch'

const MODELS: { value: ColorPickerMode; label: string }[] = [
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'oklch', label: 'OKLCH' },
]

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** HSV of an OKLCH color. A grey has no hue and black has no saturation, so
 *  those channels keep `prev` and the plane's thumb stays where it was. */
function oklchToHsv([l, c, h]: Triple, prev: Triple): Triple {
  const [hh, s, v] = chroma.oklch(l, c, h).hsv()
  if (v === 0) return [prev[0], prev[1], 0]
  if (Number.isNaN(hh) || s === 0) return [prev[0], 0, v]
  return [hh, s, v]
}

/** HSL of an OKLCH color, keeping `prev` for the channels black, white, and
 *  grey leave undefined. */
function oklchToHsl([l, c, h]: Triple, prev: Triple): Triple {
  const [hh, s, ll] = chroma.oklch(l, c, h).hsl()
  if (ll === 0 || ll === 1) return [prev[0], prev[1], ll]
  if (Number.isNaN(hh) || s === 0) return [prev[0], 0, ll]
  return [hh, s, ll]
}

/** A two-dimensional pad. `x` and `y` run 0 to 1 from the bottom left. The
 *  pointer and the arrow keys report a new pair; Shift takes a larger step. */
function Pad({
  x,
  y,
  onPick,
  label,
  valueText,
  color,
  className,
  style,
  children,
}: {
  x: number
  y: number
  onPick: (x: number, y: number) => void
  label: string
  valueText: string
  color: string
  className?: string
  style?: any
  children?: any
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pick = (e: { clientX: number; clientY: number }) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) onPick(clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height))
  }
  const stop = () => (dragging.current = false)
  return (
    <div
      ref={ref}
      className={`${styles.pad} ${className ?? ''}`}
      style={style}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={valueText}
      onPointerDown={(e: any) => {
        dragging.current = true
        e.currentTarget.setPointerCapture?.(e.pointerId)
        pick(e)
      }}
      onPointerMove={(e: any) => {
        if (dragging.current) pick(e)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e: any) => {
        const step = e.shiftKey ? 0.1 : 0.01
        const move: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        }
        const d = move[e.key]
        if (!d) return
        e.preventDefault()
        e.stopPropagation()
        onPick(clamp01(x + d[0]), clamp01(y + d[1]))
      }}
    >
      {children}
      <span className={styles.padThumb} style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%`, background: color }} />
    </div>
  )
}

/** Field swatch per field size: the field's height less a 4px inset on each side. */
const SWATCH = { small: '16px', medium: '20px', large: '24px' } as const

/** Inline custom properties, which the style type does not list. */
const vars = (v: Record<string, string>): any => v

export default function ColorPicker({
  value = '#5f4bc3',
  onChange,
  label = 'Color',
  defaultMode = 'hex',
  alpha = false,
  size = 'small',
  layout = 'inline',
}: {
  value?: string
  /** Receives six-digit hex, or eight-digit hex for a translucent color. */
  onChange?: (hex: string) => void
  label?: string
  /** The color model tab shown first. */
  defaultMode?: ColorPickerMode
  /** Adds an opacity slider to the HEX tab. */
  alpha?: boolean
  /** Size of the trigger field. The popover keeps its own sizes. */
  size?: 'small' | 'medium' | 'large'
  /** `inline` puts a monospace label left of a 230px field; `stacked` puts the label above a full-width field;
   *  `bare` is a full-width field whose label is only its accessible name, for forms that place labels themselves. */
  layout?: 'inline' | 'stacked' | 'bare'
}) {
  const [[l, c, h], setLch] = useState<Triple>(() => {
    try {
      return safeOklch(chroma(value).oklch(), 0)
    } catch {
      return [0.5, 0.15, 285]
    }
  })
  const [hsv, setHsv] = useState<Triple>(() => oklchToHsv([l, c, h], [0, 0, 0]))
  const [a, setA] = useState(() => {
    try {
      return alpha ? chroma(value).alpha() : 1
    } catch {
      return 1
    }
  })
  const [hsl, setHslState] = useState<Triple>(() => oklchToHsl([l, c, h], [0, 0, 0]))
  /** RGB, OKLCH, and the hex field edit through OKLCH. */
  const setOklch = (next: Triple) => {
    setLch(next)
    setHsv((prev) => oklchToHsv(next, prev))
    setHslState((prev) => oklchToHsl(next, prev))
  }
  /** HSV and HSL keep their own state, so a pick at black, white, or grey does
   *  not lose the hue or saturation. */
  const pickHsv = (next: Triple) => {
    const lch = safeOklch(chroma.hsv(next[0], next[1], next[2]).oklch(), h)
    setHsv(next)
    setLch(lch)
    setHslState((prev) => oklchToHsl(lch, [next[0], prev[1], prev[2]]))
  }
  const pickHsl = (next: Triple) => {
    const lch = safeOklch(chroma.hsl(next[0], next[1], next[2]).oklch(), h)
    setHslState(next)
    setLch(lch)
    setHsv((prev) => oklchToHsv(lch, [next[0], prev[1], prev[2]]))
  }
  const [hexDraft, setHexDraft] = useState(value)

  const opaque = chroma.oklch(l, c, h).hex()
  const hex = chroma.oklch(l, c, h).alpha(a).hex()
  const outOfGamut = !inGamut(l, c, h)
  const cLimit = maxChroma(l, h)

  const mounted = useRef(false)
  useEffect(() => {
    // Skip the mount pass: `hex` is the oklch round-trip of the incoming `value`,
    // so propagating it would overwrite the parent's exact seed literal with its
    // round-tripped form. Only a real edit (a later `hex` change) should call up.
    if (mounted.current) onChange?.(hex)
    else mounted.current = true
    setHexDraft(hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex])

  // The OKLCH pad: lightness left to right and chroma bottom to top, up to the
  // most sRGB can show at this hue. It depends on the hue alone.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padHue = Math.round(h)
  const cTop = useMemo(() => {
    let top = 0.01
    for (let i = 1; i < 100; i++) top = Math.max(top, maxChroma(i / 100, padHue))
    return top
  }, [padHue])
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = Math.round(PW * dpr)
    const H = Math.round(PH * dpr)
    cv.width = W
    cv.height = H
    const img = ctx.createImageData(W, H)
    for (let x = 0; x < W; x++) {
      const ll = x / (W - 1)
      const cm = maxChroma(ll, padHue)
      for (let y = H - 1; y >= 0; y--) {
        const cc = (1 - y / (H - 1)) * cTop
        // Past the gamut edge the pixel stays transparent.
        if (cc > cm) break
        const [r, g, b] = oklchToLinear(ll, cc, padHue)
        const i = (y * W + x) * 4
        img.data[i] = gamma(r) * 255
        img.data[i + 1] = gamma(g) * 255
        img.data[i + 2] = gamma(b) * 255
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [padHue, cTop])
  /** The chroma last asked for. A hue or lightness with less room lowers the
   *  chroma, and this restores it when the room comes back. */
  const wantC = useRef(c)

  const rgb = chroma.oklch(l, c, h).rgb()
  const setRgb = (i: number, v: number) => {
    const next = [rgb[0], rgb[1], rgb[2]]
    next[i] = Math.max(0, Math.min(255, v))
    setOklch(safeOklch(chroma.rgb(next[0], next[1], next[2]).oklch(), h))
  }
  const setHsl = (i: number, v: number) => {
    const next: Triple = [hsl[0], hsl[1], hsl[2]]
    next[i] = i === 0 ? ((v % 360) + 360) % 360 : clamp01(v / 100)
    pickHsl(next)
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`

  /** A channel field. `digits` rounds the shown value; `step` sets the scrub rate. */
  const field = (label: string, value: number, digits: number, max: number, step: number, onVal: (v: number) => void, tip?: any) => (
    <Chan label={label} value={Number(fx(value, digits))} min={0} max={max} step={step} onVal={onVal} tip={tip} />
  )
  /** The saturation and brightness pad HEX and RGB share. */
  const svPad = (
    <Pad
      className={styles.sv}
      style={vars({ '--acp-hue': `hsl(${hsv[0]} 100% 50%)` })}
      x={hsv[1]}
      y={hsv[2]}
      color={opaque}
      label="Saturation and brightness"
      valueText={`Saturation ${pct(hsv[1])}, brightness ${pct(hsv[2])}`}
      onPick={(x, y) => pickHsv([hsv[0], x, y])}
    />
  )
  /** A hue strip. `rail` replaces the HSL rainbow. */
  const hueStrip = (value: number, thumb: string, onVal: (v: number) => void, rail?: string) => (
    <Slider
      className={styles.hue}
      style={vars(rail ? { '--acp-color': thumb, '--acp-rail': rail } : { '--acp-color': thumb })}
      aria-label="Hue"
      min={0}
      max={360}
      value={value}
      valueDisplay="none"
      trackClick="jump"
      trackSize={12}
      thumbSize={18}
      round
      onValueChange={(_e: any, at: any) => onVal(at.value)}
    />
  )
  const svHue = hueStrip(hsv[0], `hsl(${hsv[0]} 100% 50%)`, (v) => pickHsv([v, hsv[1], hsv[2]]))
  const opacity = alpha ? (
    <Slider
      className={styles.alpha}
      style={vars({ '--acp-color': opaque })}
      aria-label="Opacity"
      min={0}
      max={100}
      value={Math.round(a * 100)}
      valueDisplay="none"
      trackClick="jump"
      trackSize={12}
      thumbSize={18}
      round
      onValueChange={(_e: any, at: any) => setA(at.value / 100)}
    />
  ) : null

  return (
    <div style={{ display: layout === 'inline' ? 'inline-block' : 'block' }}>
      {/* Inline: re-template the host grid (the element supports this) to put the
          field's own label to the left of the box, and monospace the label + value.
          Stacked keeps Input's default label above and fills the width. */}
      <style>{`
        .acp-trigger { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 8px; width: 230px; }
        .acp-trigger::part(label) { margin: 0; }
        .acp-trigger::part(label), .acp-trigger::part(input) { font-family: var(--monospace); letter-spacing: 0; }
        .acp-trigger-stacked { width: 100%; }
      `}</style>
      <Input
        className={layout === 'inline' ? 'acp-trigger' : 'acp-trigger-stacked'}
        size={size}
        label={layout === 'bare' ? undefined : label}
        aria-label={layout === 'bare' ? label : undefined}
        value={hex}
        readOnly
        style={{ cursor: 'pointer' }}
        leading={
          // The swatch sits 4px inside the field on every side: the leading
          // slot starts 7px in, so a -3px margin pulls it to 4px.
          <span className={styles.swatch} style={vars({ width: SWATCH[size], height: SWATCH[size], marginInlineStart: '-3px', borderRadius: '3px', '--acp-color': hex })} />
        }
      />
      {/* Anchor the picker to the field's box. */}
      <Menu placement="bottom-start" autoWidth>
        <div style={{ padding: 12, width: 300, display: 'grid', gap: 12, fontFamily: 'var(--sans-serif)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={styles.swatch} style={vars({ width: '34px', height: '34px', borderRadius: '8px', '--acp-color': hex })} />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <code style={{ fontSize: 13, color: 'var(--text-1)' }}>{hex}</code>
              <code style={{ fontSize: 11, color: 'var(--text-4)' }}>
                oklch({fx(l, 3)} {fx(c, 3)} {fx(h, 1)})
              </code>
            </div>
          </div>

          <Tabs options={MODELS} defaultValue={defaultMode} size="small">
            <TabPanel value="hex">
              <div className={styles.pane}>
                {svPad}
                {svHue}
                {opacity}
                <div>
                  <Input
                    size="small"
                    label="Hex"
                    value={hexDraft}
                    placeholder={alpha ? '#rrggbbaa' : '#rrggbb'}
                    onValueChange={(e: any, at: any) => {
                      // Draft tracks every keystroke so the field shows what's typed,
                      // but the color commits only on `change` (blur / Enter). Committing
                      // on each keystroke let a valid intermediate (e.g. `#5f4`) round-trip
                      // through `hex` and rewrite the field mid-edit.
                      setHexDraft(at.value)
                      if (e.type === 'change' && chroma.valid(at.value)) {
                        setOklch(safeOklch(chroma(at.value).oklch(), h))
                        if (alpha) setA(chroma(at.value).alpha())
                      }
                    }}
                  />
                </div>
              </div>
            </TabPanel>
            <TabPanel value="rgb">
              <div className={styles.pane}>
                {svPad}
                {svHue}
                {opacity}
                <div className={styles.fields}>
                  {field('R', rgb[0], 0, 255, 1, (v) => setRgb(0, v))}
                  {field('G', rgb[1], 0, 255, 1, (v) => setRgb(1, v))}
                  {field('B', rgb[2], 0, 255, 1, (v) => setRgb(2, v))}
                </div>
              </div>
            </TabPanel>
            <TabPanel value="hsl">
              <div className={styles.pane}>
                <Pad
                  className={styles.sl}
                  style={vars({ '--acp-hue': `hsl(${hsl[0]} 100% 50%)`, '--acp-grey': 'hsl(0 0% 50%)' })}
                  x={hsl[1]}
                  y={hsl[2]}
                  color={opaque}
                  label="Saturation and lightness"
                  valueText={`Saturation ${pct(hsl[1])}, lightness ${pct(hsl[2])}`}
                  onPick={(x, y) => pickHsl([hsl[0], x, y])}
                />
                {hueStrip(hsl[0], `hsl(${hsl[0]} 100% 50%)`, (v) => pickHsl([v, hsl[1], hsl[2]]))}
                {opacity}
                <div className={styles.fields}>
                  {field('H', hsl[0], 0, 360, 1, (v) => setHsl(0, v))}
                  {field('S %', hsl[1] * 100, 0, 100, 1, (v) => setHsl(1, v))}
                  {field('L %', hsl[2] * 100, 0, 100, 1, (v) => setHsl(2, v))}
                </div>
              </div>
            </TabPanel>
            <TabPanel value="oklch">
              <div className={styles.pane}>
                <Pad
                  className={styles.gamut}
                  x={l}
                  y={Math.min(1, c / cTop)}
                  color={opaque}
                  label="Lightness and chroma"
                  valueText={`Lightness ${fx(l, 3)}, chroma ${fx(c, 3)}`}
                  onPick={(x, y) => {
                    wantC.current = y * cTop
                    setOklch([x, Math.min(y * cTop, maxChroma(x, h)), h])
                  }}
                >
                  <canvas ref={canvasRef} className={styles.padCanvas} />
                </Pad>
                {/* A new hue keeps the chroma where it fits and lowers it where
                    it does not, so the color stays in gamut. */}
                {hueStrip(
                  h,
                  `oklch(0.7 0.15 ${fx(h, 1)})`,
                  (v) => setOklch([l, outOfGamut ? c : Math.min(wantC.current, maxChroma(l, v)), v]),
                  'linear-gradient(to right in oklch longer hue, oklch(0.7 0.15 0), oklch(0.7 0.15 360))',
                )}
                {opacity}
                <div className={styles.fields}>
                  {/* L and C show 4 decimals of the exact color. A scrub moves L by
                      0.01 and C by 0.005 for each step. */}
                  {field('L', l, 4, 1, 0.01, (v) => setOklch([clamp01(v), c, h]))}
                  {field('C', c, 4, CMAX, 0.005, (v) => {
                    wantC.current = Math.max(0, Math.min(CMAX, v))
                    setOklch([l, wantC.current, h])
                  }, `in-gamut chroma limit at this L / hue: ${fx(cLimit, 3)}`)}
                  {field('H', h, 1, 360, 1, (v) => setOklch([l, c, ((v % 360) + 360) % 360]))}
                </div>
              </div>
            </TabPanel>
          </Tabs>

          {outOfGamut ? (
            <div style={{ fontSize: 11, color: 'var(--text-2-warning)' }}>
              Outside sRGB — clips to <code>{hex}</code> when rendered.
            </div>
          ) : null}
        </div>
      </Menu>
    </div>
  )
}
