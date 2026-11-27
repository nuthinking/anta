/**
 * Line templates taken from the shipped CSS, so the configurator always
 * matches the package. The caller passes the CSS text: the site imports the
 * files with Vite `?raw`, tests read them from disk.
 *
 * Parsing is deliberately strict. If a rule or token this module expects is
 * missing or changes shape, it throws, so a package change fails a test
 * instead of silently producing a wrong theme.
 */

export type Mode = 'light' | 'dark'
export const TONED_TONES = ['brand', 'info', 'success', 'warning', 'critical'] as const
export type TonedTone = (typeof TONED_TONES)[number]

/** The twelve limit variables in `tokens.css`, in display order. */
export const LIMIT_VARS = [
  '--anta-solid-l-min',
  '--anta-solid-l-max',
  '--anta-solid-l-hover',
  '--anta-solid-l-active',
  '--anta-solid-c-scale',
  '--anta-solid-c-max',
  '--anta-on-solid-flip',
  '--anta-fg-l-min',
  '--anta-fg-l-max',
  '--anta-fg-l-hover',
  '--anta-fg-c-scale',
  '--anta-fg-c-max',
] as const
export type LimitVar = (typeof LIMIT_VARS)[number]
export type Limits = Record<LimitVar, number>

/** One line, with its light and dark values. Equal when the source is not `light-dark()`. */
export interface Template {
  prop: string
  light: string
  dark: string
}

export interface RuleTemplate {
  /** Key within the family, for example `toned` or `primary`. */
  scope: string
  /** Selectors the configurator writes for this rule. */
  selectors: string[]
  lines: Template[]
}

export interface FamilyTemplate {
  id: string
  kind: 'component' | 'role'
  rules: RuleTemplate[]
  /** Properties whose trailing alpha is a tint strength. */
}

export interface Templates {
  limits: Record<Mode, Limits>
  families: FamilyTemplate[]
  /** Pixel font sizes from `tokens.css`, by token name. */
  fontSizes: Record<string, number>
}

export interface Sources {
  tokens: string
  button: string
  tag: string
  checkbox: string
  radio: string
  switch: string
}

const TONED = ':not([tone=""], [tone="neutral"])'

/** Split `light-dark(a, b)` at its top-level comma. Other values apply to both modes. */
export function splitLightDark(value: string): [string, string] {
  const v = value.trim()
  if (!v.startsWith('light-dark(') || !v.endsWith(')')) return [v, v]
  const inner = v.slice('light-dark('.length, -1)
  let depth = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()]
  }
  throw new Error(`Unbalanced light-dark(): ${v}`)
}

const normalise = (v: string) => v.replace(/\s+/g, ' ').trim()

function declarations(body: string): Template[] {
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, value]) => {
    const [light, dark] = splitLightDark(normalise(value))
    return { prop, light, dark }
  })
}

/** The body of the first rule whose selector list starts with `selector`. */
function ruleBody(css: string, selector: string, file: string): string {
  const at = css.indexOf(selector)
  if (at < 0) throw new Error(`${file}: rule not found: ${selector}`)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  const body = css.slice(open + 1, close)
  if (body.includes('{')) throw new Error(`${file}: nested block inside ${selector}`)
  return body
}

/** A rule's declarations, checked to be identical across its alternative selectors. */
function rule(css: string, file: string, scope: string, sources: string[], selectors: string[]): RuleTemplate {
  const [first, ...rest] = sources.map((s) => declarations(ruleBody(css, s, file)))
  if (!first.length) throw new Error(`${file}: empty rule ${sources[0]}`)
  for (const [i, other] of rest.entries()) {
    if (JSON.stringify(other) !== JSON.stringify(first)) throw new Error(`${file}: ${sources[i + 1]} differs from ${sources[0]}`)
  }
  return { scope, selectors, lines: first }
}

/** Unlayered `:root, .light` and `.dark` token blocks of `tokens.css`. */
function tokenBlocks(tokens: string): Record<Mode, string> {
  const lightAt = tokens.indexOf('\n:root,\n.light {')
  const darkAt = tokens.indexOf('\n.dark {')
  if (lightAt < 0 || darkAt < 0 || darkAt < lightAt) throw new Error('tokens.css: token blocks not found')
  return { light: tokens.slice(lightAt, darkAt), dark: tokens.slice(darkAt) }
}

function parseLimits(block: string, mode: Mode): Limits {
  const out = {} as Limits
  for (const name of LIMIT_VARS) {
    const m = block.match(new RegExp(`${name}:\\s*(-?[\\d.]+);`))
    if (!m) throw new Error(`tokens.css: ${name} missing in ${mode} block`)
    out[name] = Number(m[1])
  }
  return out
}

/** Role tokens per tone; the `neutral` rule holds the unsuffixed tokens. */
function roleFamily(id: string, blocks: Record<Mode, string>, pattern: RegExp): FamilyTemplate {
  const read = (mode: Mode) => new Map(declarations(blocks[mode]).filter((d) => pattern.test(d.prop)).map((d) => [d.prop, d.light]))
  const light = read('light')
  const dark = read('dark')
  if (!light.size) throw new Error(`tokens.css: no ${id} role tokens`)
  const rules = (['neutral', ...TONED_TONES] as const).map((tone) => {
    const own = (prop: string) => (tone === 'neutral' ? /-\d$/.test(prop) : prop.endsWith(`-${tone}`))
    const lines = [...light].filter(([prop]) => own(prop)).map(([prop, value]) => {
      const d = dark.get(prop)
      if (d === undefined) throw new Error(`tokens.css: ${prop} has no dark value`)
      return { prop, light: value, dark: d }
    })
    if (!lines.length) throw new Error(`tokens.css: no ${tone} ${id} tokens`)
    return { scope: tone, selectors: [], lines }
  })
  return { id, kind: 'role', rules }
}

const toned = (...selectors: string[]) => selectors.map((s) => `${s}[tone]${TONED}`)

/** Read every template from the shipped CSS. */
export function readTemplates(src: Sources): Templates {
  const blocks = tokenBlocks(src.tokens)
  const button = toned('a-button', 'a[role="button"][data-anta]', 'button[data-anta]', 'input[data-anta]:is([type="reset"], [type="submit"])')
  const checkbox = toned('a-checkbox', 'input[data-anta][type="checkbox"]')
  const radioSelectors = [...toned('a-radio'), `a-radio-group[tone]${TONED} a-radio:not([tone])`, ...toned('input[data-anta][type="radio"]')]

  const fontSizes = Object.fromEntries([...src.tokens.matchAll(/(--font-size-[\w-]+):\s*(\d+(?:\.\d+)?)px;/g)].map((m) => [m[1], Number(m[2])]))
  if (Object.keys(fontSizes).length < 10) throw new Error('tokens.css: font sizes not found')

  return {
    fontSizes,
    limits: { light: parseLimits(blocks.light, 'light'), dark: parseLimits(blocks.dark, 'dark') },
    families: [
      roleFamily('surface', blocks, /^--(bg|border)-\d(-(brand|info|success|warning|critical))?$/),
      roleFamily('text', blocks, /^--text-\d(-(brand|info|success|warning|critical))?$/),
      {
        id: 'button',
        kind: 'component',
        rules: [rule(src.button, 'a-button.css', 'toned', [`${button[0]},`], button)],
      },
      {
        id: 'tag',
        kind: 'component',
        rules: [
          rule(src.tag, 'a-tag.css', 'toned', [`a-tag[tone]${TONED} {`], toned('a-tag')),
          rule(src.tag, 'a-tag.css', 'primary', [`a-tag[priority="primary"][tone]${TONED} {`], toned('a-tag[priority="primary"]')),
        ],
      },
      {
        id: 'checkbox',
        kind: 'component',
        rules: [rule(src.checkbox, 'a-checkbox.css', 'toned', checkbox.map((s) => `${s} {`), checkbox)],
      },
      {
        id: 'radio',
        kind: 'component',
        rules: [rule(src.radio, 'a-radio.css', 'toned', [`${radioSelectors[0]},`, `${radioSelectors[2]} {`], radioSelectors)],
      },
      {
        id: 'switch',
        kind: 'component',
        rules: [rule(src.switch, 'a-switch.css', 'toned', [`a-switch[tone]${TONED} {`], toned('a-switch'))],
      },
    ],
  }
}

const fmt = (n: number) => String(+n.toFixed(4))

export interface RenderParams {
  /** Limit variables to write in as numbers. Absent ones stay `var(--…)` references. */
  limits: Partial<Limits>
}

export function renderValue(value: string, params: RenderParams): string {
  const v = value
  return v.replace(/var\((--anta-(?:solid|fg|on)-[\w-]+)\)/g, (whole, name: string) => {
    if (!(LIMIT_VARS as readonly string[]).includes(name)) throw new Error(`Unknown limit variable ${name}`)
    const n = params.limits[name as LimitVar]
    return n === undefined ? whole : fmt(n)
  })
}
