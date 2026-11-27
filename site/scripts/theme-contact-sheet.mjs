#!/usr/bin/env node
/**
 * Renders a contact sheet for tuning the theme configurator's choices: ten
 * brand colors by every All components option, in light and dark. Each cell
 * shows Button priorities in rest, hover and pressed, primary and secondary
 * Tags, a checked Checkbox, and the brand surface and border scales.
 *
 *   node site/scripts/theme-contact-sheet.mjs <output.html>
 *
 * Needs the built package (`pnpm run build`) and Node 24, which runs the
 * TypeScript sources directly.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL, defaultState } from '../src/components/theme-configurator/model.ts'
import { readTemplates } from '../src/components/theme-configurator/templates.ts'
import { renderTheme } from '../src/components/theme-configurator/generate.ts'
import { setChoice, setIntensity } from '../src/components/theme-configurator/match.ts'
import { FACTORS } from '../src/components/theme-configurator/presets.ts'
import { contrastWithWhite, hexToOklch } from '../src/components/theme-configurator/color.ts'

const out = process.argv[2]
if (!out) {
  console.error('Usage: node site/scripts/theme-contact-sheet.mjs <output.html>')
  process.exit(1)
}

const root = new URL('../../', import.meta.url)
const file = (p) => readFileSync(new URL(p, root), 'utf8')
const t = readTemplates({
  tokens: file('src/tokens.css'),
  button: file('src/elements/a-button.css'),
  tag: file('src/elements/a-tag.css'),
  checkbox: file('src/elements/a-checkbox.css'),
  radio: file('src/elements/a-radio.css'),
  switch: file('src/elements/a-switch.css'),
})
const bundle = file('dist/bundle.css')

const BRANDS = [
  ['Red', '#d0342c'],
  ['Orange', '#e8701a'],
  ['Yellow', '#eab308'],
  ['Green', '#2e8540'],
  ['Teal', '#0f766e'],
  ['Blue', '#2563eb'],
  ['Violet (Anta)', '#5f4bc3'],
  ['Magenta', '#c026d3'],
  ['Pale pink', '#f9a8d4'],
  ['Very dark navy', '#1e293b'],
]

const VARIANTS = [
  ['Standard', (s) => s],
  ['Color: Muted', (s) => setIntensity(t, s, 0)],
  ['Color: Vivid', (s) => setIntensity(t, s, 2)],
  ['State: Subtle', (s) => setChoice(t, s, ALL, 'state', 0)],
  ['State: Strong', (s) => setChoice(t, s, ALL, 'state', 2)],
]

const STATES = {
  primary: [
    ['Rest', ''],
    ['Hover', '--button-bg: var(--button-bg-primary-hover)'],
    ['Pressed', '--button-bg: var(--button-bg-primary-active)'],
  ],
  secondary: [
    ['Rest', ''],
    ['Hover', '--button-fg: var(--button-fg-secondary-hover); --button-bg: var(--button-bg-secondary-hover)'],
    ['Pressed', '--button-fg: var(--button-fg-secondary-hover); --button-bg: var(--button-bg-secondary-active)'],
  ],
  tertiary: [
    ['Rest', ''],
    ['Hover', '--button-fg: var(--button-fg-tertiary-hover); --button-bg: var(--button-bg-tertiary-hover)'],
    ['Pressed', '--button-fg: var(--button-fg-tertiary-hover); --button-bg: var(--button-bg-tertiary-active)'],
  ],
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

let n = 0
const styles = []
function cell(brand, apply, mode) {
  const cls = `s${n++}`
  const state = apply({ ...defaultState(), seeds: { ...defaultState().seeds, brand } })
  styles.push(renderTheme(t, state, { scope: `.${cls}` }))
  const buttons = Object.entries(STATES)
    .map(([priority, states]) =>
      states
        .map(([label, style]) => `<button data-anta type="button" tone="brand" priority="${priority}" size="small" title="${priority} ${label.toLowerCase()}"${style ? ` style="${style}"` : ''}>Save</button>`)
        .join(''),
    )
    .map((row) => `<div class="row">${row}</div>`)
    .join('')
  const others = `<div class="row others"><a-tag tone="brand" priority="primary" size="small">Tag</a-tag><a-tag tone="brand" priority="secondary" size="small">Tag</a-tag><input data-anta type="checkbox" tone="brand" checked aria-label="Checked"></div>`
  const swatch = (v) => `<i style="background: var(${v})" title="${v}"></i>`
  const surfaces = [2, 3, 4, 5].map((i) => swatch(`--bg-${i}-brand`)).join('')
  const borders = [1, 2, 3, 4, 5].map((i) => swatch(`--border-${i}-brand`)).join('')
  return `<td><div class="cell ${cls} ${mode}">${buttons}${others}<div class="swatches">${surfaces}<span></span>${borders}</div></div></td>`
}

function section(mode) {
  const head = `<tr><th></th>${VARIANTS.map(([v]) => `<th>${esc(v)}</th>`).join('')}</tr>`
  const rows = BRANDS.map(([name, hex]) => {
    const c = hexToOklch(hex)
    const meta = `L ${c.l.toFixed(2)} · C ${c.c.toFixed(3)} · white ${contrastWithWhite(c).toFixed(1)}:1`
    return `<tr><th class="brand"><i style="background:${hex}"></i>${esc(name)}<br><code>${hex}</code><br><small>${meta}</small></th>${VARIANTS.map(([, apply]) => cell(hex, apply, mode)).join('')}</tr>`
  }).join('\n')
  return `<h2>${mode === 'light' ? 'Light' : 'Dark'}</h2><div class="scroll"><table>${head}${rows}</table></div>`
}

const body = section('light') + section('dark')
const factors = Object.entries(FACTORS)
  .map(([k, v]) => `<li><b>${k}</b>: ${v.join(' / ')}</li>`)
  .join('')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Theme configurator contact sheet</title>
<style>${bundle}</style>
<style>${styles.join('\n')}</style>
<style>
  body { margin: 24px; font: 13px/1.4 system-ui, sans-serif; background: #fff; color: #1f2328; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 32px 0 8px; }
  p, ul { max-width: 900px; }
  .scroll { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 4px; }
  th { font-weight: 600; text-align: left; vertical-align: top; white-space: nowrap; padding: 4px; }
  th.brand { font-weight: 500; }
  th.brand i { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; }
  th small { color: #6b7280; font-weight: 400; }
  td { padding: 0; vertical-align: top; }
  .cell { background: var(--bg-1); color: var(--text-1); padding: 8px; border-radius: 6px; display: grid; gap: 4px; }
  .row { display: flex; gap: 4px; align-items: center; }
  .swatches { display: flex; gap: 2px; margin-top: 4px; }
  .swatches i { width: 14px; height: 14px; border-radius: 2px; box-shadow: inset 0 0 0 1px color-mix(in oklch, currentColor 10%, transparent); }
  .swatches span { width: 6px; }
</style>
</head>
<body>
<h1>Theme configurator contact sheet</h1>
<p>Each cell is the brand tone with one All components choice moved from Standard. Rows: primary, secondary and tertiary buttons in rest, hover and pressed; then primary and secondary Tags and a checked Checkbox; then <code>--bg-2…5-brand</code> and <code>--border-1…5-brand</code>. Colorfulness is the Intensity dial.</p>
<ul>${factors}</ul>
${body}
</body>
</html>
`
writeFileSync(resolve(out), html)
console.log(`Wrote ${resolve(out)} (${BRANDS.length} brands × ${VARIANTS.length} variants × 2 modes)`)
