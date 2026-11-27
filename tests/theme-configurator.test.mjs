import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ALL, decodeState, defaultState, editKey, encodeState } from '../site/src/components/theme-configurator/model.ts'
import { readTemplates, LIMIT_VARS } from '../site/src/components/theme-configurator/templates.ts'
import { DESIGN_WIDTH, contentWidth, layout } from '../site/src/components/theme-configurator/layout.ts'
import { changedDecls, familyDecls, followsAll, renderTheme } from '../site/src/components/theme-configurator/generate.ts'
import {
  choicesFor,
  intensityLevel,
  resetFamily,
  selectedLevel,
  setChoice,
  setEdit,
  setIntensity,
} from '../site/src/components/theme-configurator/match.ts'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const t = readTemplates({
  tokens: await read('../src/tokens.css'),
  button: await read('../src/elements/a-button.css'),
  tag: await read('../src/elements/a-tag.css'),
  checkbox: await read('../src/elements/a-checkbox.css'),
  radio: await read('../src/elements/a-radio.css'),
  switch: await read('../src/elements/a-switch.css'),
})
const COMPONENTS = ['button', 'tag', 'checkbox', 'radio', 'switch']
const decl = (state, family, scope, prop) => familyDecls(t, state, family).find((d) => d.scope === scope && d.prop === prop)

test('templates come from the shipped CSS', () => {
  assert.equal(t.limits.light['--anta-solid-l-min'], 0.42)
  assert.equal(t.limits.dark['--anta-solid-l-min'], 0.38)
  assert.equal(t.limits.dark['--anta-fg-c-scale'], 0.75)
  assert.deepEqual(t.families.map((f) => f.id), ['surface', 'text', ...COMPONENTS])
  const solid = t.families.find((f) => f.id === 'button').rules[0].lines.find((l) => l.prop === '--_solid')
  assert.match(solid.light, /clamp\(var\(--anta-solid-l-min\), l, var\(--anta-solid-l-max\)\)/)
  assert.ok(t.families.find((f) => f.id === 'surface').rules.find((r) => r.scope === 'brand').lines.some((l) => l.prop === '--bg-3-brand'))
  assert.equal(t.fontSizes['--font-size-medium'], 15)
})

test('extraction fails loudly when a rule changes shape', () => {
  const src = async () => ({
    tokens: await read('../src/tokens.css'),
    button: await read('../src/elements/a-button.css'),
    tag: await read('../src/elements/a-tag.css'),
    checkbox: await read('../src/elements/a-checkbox.css'),
    radio: await read('../src/elements/a-radio.css'),
    switch: await read('../src/elements/a-switch.css'),
  })
  return src().then((s) => {
    assert.throws(() => readTemplates({ ...s, switch: s.switch.replace('a-switch[tone]:not', 'a-toggle[tone]:not') }), /rule not found/)
    const drift = s.checkbox.replace(/(input\[data-anta\]\[type="checkbox"\]\[tone\]:not[^{]+\{\s*--checkbox-bg-selected: oklch\(from var\(--checkbox-tone-source\)) clamp/, '$1 CLAMP')
    assert.throws(() => readTemplates({ ...s, checkbox: drift }), /differs/)
    assert.throws(() => readTemplates({ ...s, tokens: s.tokens.replace('--anta-on-solid-flip: 0.72;', '') }), /--anta-on-solid-flip missing/)
  })
})

test('the default state generates no theme', () => {
  assert.equal(renderTheme(t, defaultState()), '')
  for (const f of t.families) assert.equal(changedDecls(t, defaultState(), f.id).length, 0, f.id)
})

test('a brand change emits only seeds, unlayered like tokens.css', () => {
  const state = defaultState()
  state.seeds.brand = '#0f766e'
  const css = renderTheme(t, state)
  assert.match(css, /^@layer base, anta, components, utilities;/)
  // The brand seed, the default Tinted neutral turning with it, and the status colors following it.
  assert.match(css, /\n:root, \.light \{\n  --anta-seed-neutral: oklch\([^)]+\);\n  --anta-seed-brand: #0f766e;\n  --anta-seed-info: #[0-9a-f]{6};/)
  assert.doesNotMatch(css, /--button-|--bg-|--text-|@layer anta\.theme \{/)
  // With a custom neutral and custom status colors, only the brand seed changes.
  const fixed = { ...state, neutral: 'custom', status: 'custom' }
  assert.match(renderTheme(t, fixed), /\n:root, \.light \{\n  --anta-seed-brand: #0f766e;\n\}/)
})

test('limits are set as variables: at the root for All, on the component for an entry', () => {
  // State change on All: four variable lines, and no component rule copied out.
  const strong = renderTheme(t, setChoice(t, defaultState(), ALL, 'state', 2))
  assert.match(strong, /:root, \.light \{\n  --anta-solid-l-hover: -?[\d.]+;\n  --anta-solid-l-active: -?[\d.]+;/)
  assert.match(strong, /\.dark \{\n  --anta-solid-l-hover: [\d.]+;\n  --anta-solid-l-active: [\d.]+;/)
  assert.doesNotMatch(strong, /--button-bg-primary-hover|@layer anta\.theme \{/)
  // State change on Checkbox only: a rule on Checkbox for each mode, nothing at the root.
  const boxes = renderTheme(t, setChoice(t, defaultState(), 'checkbox', 'state', 2))
  assert.doesNotMatch(boxes, /:root, \.light \{/)
  assert.match(boxes, /a-checkbox[^{]*\{\n    --anta-solid-l-hover: -?[\d.]+;/)
  assert.match(boxes, /\.dark a-checkbox[^{]*\{\n    --anta-solid-l-hover: [\d.]+;/)
  // Formula lines keep their references, as in Anta's own CSS.
  assert.match(decl(defaultState(), 'button', 'toned', '--button-bg-primary-hover').light, /var\(--anta-solid-l-hover\)/)
})

test('component lines go in the theme layer and role tokens stay outside it', () => {
  let state = setEdit(t, defaultState(), 'surface', 'light', 'brand', '--bg-3-brand', 'oklch(from var(--anta-seed-brand) 0.96 0.02 h)')
  state = setEdit(t, state, 'button', 'light', 'toned', '--button-bg-secondary-rest', 'oklch(from var(--_src) 0.54 0.2 h / 0.2)')
  state = setEdit(t, state, 'text', 'light', 'brand', '--text-2-brand', 'oklch(from var(--anta-seed-brand) 0.4 0.1 h)')
  const css = renderTheme(t, state)
  const layerStart = css.indexOf('@layer anta.theme {')
  assert.ok(layerStart > 0)
  assert.ok(css.indexOf('--bg-3-brand') > 0 && css.indexOf('--bg-3-brand') < layerStart)
  assert.ok(css.indexOf('--text-2-brand') < layerStart)
  assert.ok(css.indexOf('--button-bg-secondary-rest') > layerStart)
  // Both modes are kept for a changed role token.
  assert.match(css, /\.dark \{[^}]*--bg-3-brand:/)
})

test('choices only set limit variables, so a theme stays short', async () => {
  const vivid = renderTheme(t, setChoice(t, setChoice(t, defaultState(), ALL, 'color', 2), ALL, 'state', 2))
  // Intensity scales the brand and status seeds, noted on each line, and raises the caps.
  assert.match(vivid, /--anta-seed-brand: #[0-9a-f]{6}; \/\* #5f4bc3 at Vivid intensity \*\//)
  assert.match(vivid, /--anta-seed-critical: #[0-9a-f]{6};/)
  assert.doesNotMatch(vivid, /--anta-seed-neutral|--anta-solid-c-scale/)
  assert.match(vivid, /--anta-solid-c-max: [\d.]+;/)
  assert.match(vivid, /--anta-solid-l-hover: -?[\d.]+;/)
  // No role token or component rule is rewritten.
  assert.doesNotMatch(vivid, /--bg-3-brand|--button-|@layer anta\.theme \{/)
  assert.ok(vivid.split('\n').length < 25)

  // Muted lowers the seed's chroma, same hue and lightness.
  const { hexToOklch } = await import('../site/src/components/theme-configurator/color.ts')
  const muted = renderTheme(t, setChoice(t, defaultState(), ALL, 'color', 0))
  const brand = hexToOklch(/--anta-seed-brand: (#[0-9a-f]{6})/.exec(muted)[1])
  const anta = hexToOklch('#5f4bc3')
  assert.ok(Math.abs(brand.c - anta.c * 0.7) < 0.01 && Math.abs(brand.h - anta.h) < 2 && Math.abs(brand.l - anta.l) < 0.01)
  // Back to Balanced leaves no trace in the state, so links stay clean.
  assert.deepEqual(setChoice(t, setChoice(t, defaultState(), ALL, 'color', 2), ALL, 'color', 1).choices[ALL], {})
})

test('every option of every choice round-trips, for All and each family', () => {
  for (const family of [ALL, ...t.families.map((f) => f.id)]) {
    const offered = choicesFor(t, family)
    for (const choice of offered) {
      for (const level of [0, 1, 2]) {
        const state = setChoice(t, defaultState(), family, choice, level)
        assert.equal(selectedLevel(t, state, family, choice), level, `${family} ${choice} ${level}`)
        for (const other of offered) if (other !== choice) assert.equal(selectedLevel(t, state, family, other), 1, `${family}: ${other} after ${choice} ${level}`)
      }
    }
  }
  assert.deepEqual(choicesFor(t, ALL), ['color', 'state'])
  assert.deepEqual(choicesFor(t, 'button'), ['color', 'state'])
  assert.deepEqual(choicesFor(t, 'tag'), ['color'])
  // Surfaces and Text have no limit to set: they are edited as CSS only.
  assert.deepEqual(choicesFor(t, 'surface'), [])
  assert.deepEqual(choicesFor(t, 'text'), [])
})

test('editing one number deselects only the choices that own it', () => {
  const prop = '--_solid'
  const value = decl(defaultState(), 'button', 'toned', prop).light
  const lighter = setEdit(t, defaultState(), 'button', 'light', 'toned', prop, value.replace('var(--anta-solid-l-min), l,', 'var(--anta-solid-l-min), calc(l + 0.1),'))
  assert.notEqual(lighter, defaultState())
  assert.equal(selectedLevel(t, lighter, 'button', 'color'), 1)
  assert.equal(selectedLevel(t, lighter, 'button', 'state'), 1)
  assert.equal(followsAll(t, lighter, 'button'), false)

  const flip = setEdit(t, defaultState(), ALL, 'light', 'root', '--anta-on-solid-flip', '0.85')
  for (const choice of ['color', 'state']) assert.equal(selectedLevel(t, flip, ALL, choice), 1, choice)
  assert.match(decl(flip, 'button', 'toned', '--button-fg-primary-rest').light, /var\(--anta-on-solid-flip\)/)
  assert.equal(decl(flip, 'button', 'limits', '--anta-on-solid-flip').light, '0.85')
  assert.match(renderTheme(t, flip), /:root, \.light \{\n  --anta-on-solid-flip: 0\.85;/)

  // Editing a number a choice owns deselects that choice only.
  const hover = setEdit(t, defaultState(), ALL, 'dark', 'root', '--anta-solid-l-hover', '0.07')
  assert.equal(selectedLevel(t, hover, ALL, 'state'), null)
  assert.equal(selectedLevel(t, hover, ALL, 'color'), 1)

  // A choice keeps hand edits to lines it does not own.
  const reselected = setChoice(t, lighter, 'button', 'state', 2)
  assert.equal(selectedLevel(t, reselected, 'button', 'state'), 2)
  assert.ok(reselected.edits.button.light?.[editKey('toned', prop)])
})

test('families follow All components until they get their own choice', () => {
  const all = setChoice(t, defaultState(), ALL, 'state', 2)
  // Following All adds nothing of its own: the root variables cover it.
  for (const f of COMPONENTS) assert.equal(changedDecls(t, all, f).length, 0, f)
  assert.ok(followsAll(t, all, 'button'))

  const own = setChoice(t, all, 'button', 'state', 0)
  assert.equal(selectedLevel(t, own, 'button', 'state'), 0)
  assert.equal(selectedLevel(t, own, 'checkbox', 'state'), 2)
  assert.equal(followsAll(t, own, 'button'), false)
  assert.ok(changedDecls(t, own, 'button').every((d) => d.scope === 'limits'))
  assert.equal(followsAll(t, resetFamily(own, 'button'), 'button'), true)

  const back = setChoice(t, own, 'button', 'state', 2)
  assert.equal(back.choices.button.state, undefined)
})

test('Intensity sets Colorfulness everywhere and clears family overrides', () => {
  const own = setChoice(t, defaultState(), 'button', 'color', 2)
  assert.equal(intensityLevel(t, own), null)
  const state = setIntensity(t, own, 0)
  assert.equal(intensityLevel(t, state), 0)
  for (const f of [ALL, 'surface', 'text', ...COMPONENTS]) assert.equal(selectedLevel(t, state, f, 'color'), 0, f)
})

test('the Neutral dial tints or greys the neutral tokens', () => {
  // Tinted is the default: Anta's brand gives Anta's own neutral, so nothing is written.
  assert.equal(defaultState().neutral, 'tinted')
  assert.equal(renderTheme(t, defaultState()), '')
  // A new brand turns Anta's neutral grey by the same hue step (teal 186.39° + 33.87° = 220.26°).
  const tinted = { ...defaultState(), seeds: { ...defaultState().seeds, brand: '#0f766e' } }
  assert.match(renderTheme(t, tinted), /--anta-seed-neutral: oklch\(0\.4822 0\.0187 220\.26\d*\);/)
  const custom = { ...defaultState(), neutral: 'custom', seeds: { ...defaultState().seeds, neutral: '#777777' } }
  assert.match(renderTheme(t, custom), /--anta-seed-neutral: #777777;/)
  const grey = { ...defaultState(), neutral: 'grey' }
  assert.equal(decl(grey, 'surface', 'neutral', '--bg-3').light, 'oklch(from var(--anta-seed-neutral) 0.97 0 h)')
  assert.equal(decl(grey, 'surface', 'brand', '--bg-3-brand').light, decl(defaultState(), 'surface', 'brand', '--bg-3-brand').light)
  const css = renderTheme(t, grey)
  assert.match(css, /--text-2: oklch\(from var\(--anta-seed-neutral\) 0\.3 0 h\);/)
  assert.doesNotMatch(css, /--anta-seed-neutral:/)
})

test('type dials write font tokens and a serif title rule', () => {
  const state = { ...defaultState(), type: { font: 'system', titles: 'serif', size: 2 } }
  const css = renderTheme(t, state)
  assert.match(css, /--sans-serif: system-ui,/)
  assert.match(css, /--font-size-medium: 16px;/)
  assert.match(css, /@layer anta\.theme \{[\s\S]*a-title:is\(\[level="1"\], \[level="2"\], \[level="3"\]\):not\(\[font\]\) \{\s*font-family: var\(--serif\);/)
})

test('unsafe or unknown edits never reach the output', () => {
  const state = defaultState()
  for (const value of ['red; } body { color: red', 'url(https://example.com/x.png)', '@import "x.css"', 'red /* x */', '']) {
    assert.equal(setEdit(t, state, 'button', 'light', 'toned', '--_solid', value), state, value)
  }
  assert.equal(setEdit(t, state, 'button', 'light', 'toned', '--made-up', 'red'), state)
  assert.equal(setEdit(t, state, ALL, 'light', 'root', '--anta-on-solid-flip', 'red'), state)
  const forced = structuredClone(state)
  forced.edits.button = { light: { [editKey('toned', '--_solid')]: 'url(x)' } }
  assert.doesNotMatch(renderTheme(t, forced), /url\(/)
})

test('the preview fills the space until screens reach actual size, then stops growing', () => {
  let previous = 0
  for (let available = 300; available <= 3600; available += 7) {
    for (const view of ['grid', 'list']) {
      const { columns, zoom, width } = layout(view, available)
      // Half size at least, except on a phone, where one column fills the space.
      if (available >= contentWidth(1, 0.5)) assert.ok(zoom >= 0.5 && zoom <= 1, `${view} ${available}: zoom ${zoom}`)
      assert.equal(width, Math.floor(contentWidth(columns, zoom)))
      assert.ok(width <= available, `${view} ${available}: ${width} fits`)
      if (view === 'list') assert.equal(columns, 1)
    }
    const { width } = layout('grid', available)
    assert.ok(width >= previous, `grid width never shrinks as space grows (${available})`)
    previous = width
  }
  // Two 800px screens at half size need 2 × 400 + 16 gap + 2 × 16 padding = 848px.
  assert.deepEqual(layout('grid', 600), { columns: 1, zoom: 0.71, width: 600 })
  assert.deepEqual(layout('grid', 847), { columns: 1, zoom: 1, width: 832 })
  assert.deepEqual(layout('grid', 848), { columns: 2, zoom: 0.5, width: 848 })
  assert.deepEqual(layout('grid', 1248), { columns: 2, zoom: 0.75, width: 1248 })
  assert.deepEqual(layout('grid', 1700), { columns: 2, zoom: 1, width: 1648 })
  // A 360px phone: one column, below half size, filling the width.
  assert.deepEqual(layout('grid', 358), { columns: 1, zoom: 0.4074, width: 357 })
  // Two columns at most: past actual size the preview stops growing.
  assert.deepEqual(layout('grid', 4000), { columns: 2, zoom: 1, width: 1648 })
  // Once screens reach actual size they never shrink again.
  for (let available = 1648; available <= 4000; available += 5) assert.equal(layout('grid', available).zoom, 1, `${available}`)
  assert.deepEqual(layout('list', 1700), { columns: 1, zoom: 1, width: 832 })
  // Below actual size the preview fills the space exactly.
  for (const available of [500, 900, 1300]) assert.ok(available - layout('grid', available).width <= 1, `${available} filled`)
  assert.equal(DESIGN_WIDTH, 800)
})

test('the URL hash round-trips and rejects junk', () => {
  let state = defaultState()
  state.seeds.brand = '#0f766e'
  state.neutral = 'tinted'
  state.type = { font: 'humanist', titles: 'serif', size: 0 }
  state = setChoice(t, state, 'button', 'state', 2)
  const decoded = decodeState(encodeState(state))
  assert.equal(decoded.seeds.brand, '#0f766e')
  assert.equal(decoded.neutral, 'tinted')
  assert.equal(decoded.choices.button.state, 2)
  // Links made before Fill and Tint strength were removed open without them.
  assert.deepEqual(decodeState(encodeURIComponent(JSON.stringify({ choices: { all: { fill: 2, tint: 0, color: 2 } } }))).choices, { all: { color: 2 } })
  assert.deepEqual(decoded.type, state.type)
  assert.equal(decodeState(encodeURIComponent(JSON.stringify({ type: { font: 'x; } body {' } }))).type.font, 'default')
  assert.deepEqual(decodeState('%7B%22seeds%22%3A%7B%22brand%22%3A%22javascript%3A%22%7D%7D').seeds, defaultState().seeds)
  assert.deepEqual(decodeState('not json'), defaultState())
  assert.equal(LIMIT_VARS.length, 12)
})

test('shipped themes re-derive for new seeds and reproduce themselves at their own', async () => {
  const { renderShipped } = await import('../site/src/components/theme-configurator/generate.ts')
  const { shippedSeeds } = await import('../site/src/components/theme-configurator/rederive.ts')
  const { stateFor } = await import('../site/src/components/theme-configurator/model.ts')
  for (const name of ['antune', 'antithesis']) {
    const css = await read(`../src/theme-${name}.css`)
    const own = shippedSeeds(css)
    const state = stateFor(name, own)
    // Unchanged: the file as shipped, byte for byte.
    assert.equal(renderShipped(t, state, css, own), css)
    // A new brand moves brand lines only; lines and comments stay in place.
    const teal = renderShipped(t, { ...state, neutral: 'custom', status: 'custom', seeds: { ...own, brand: '#0f766e' } }, css, own)
    const before = css.split('\n')
    const after = teal.split('\n')
    const changed = before.filter((line, i) => line !== after[i])
    assert.ok(changed.length > 20, `${name}: brand lines change`)
    assert.ok(changed.every((line) => /brand|focus|seed/i.test(line) || !/(success|warning|critical|info)\b/.test(line)), `${name}: status lines stay`)
    assert.ok(before.filter((l) => l.includes('/*')).every((l) => after.includes(l)), `${name}: comments stay`)
    // Intensity reaches the theme through its seeds, once: brand lines move by the seed's chroma change only.
    const vivid = renderShipped(t, setChoice(t, state, ALL, 'color', 2), css, own)
    assert.notEqual(vivid, css)
    assert.equal(vivid.split('\n').length >= css.split('\n').length, true)
    // Type and shape dials append after the theme.
    const serif = renderShipped(t, { ...state, type: { ...state.type, titles: 'serif' } }, css, own)
    assert.ok(serif.startsWith(css.trimEnd()))
    assert.match(serif, /font-family: var\(--serif\);/)
  }
})

test('links store seeds as changes from the base theme', async () => {
  const { stateFor } = await import('../site/src/components/theme-configurator/model.ts')
  const own = { ...defaultState().seeds, brand: '#cc4636' }
  const seedsFor = (base) => (base === 'antithesis' ? own : defaultState().seeds)
  const state = stateFor('antithesis', own)
  assert.equal(decodeURIComponent(encodeState(state, seedsFor)), '{"v":2,"base":"antithesis"}')
  assert.deepEqual(decodeState(encodeState(state, seedsFor), seedsFor), state)
})

test('website readings give three ranked brand colors and control suggestions', async () => {
  const { rankBrands, suggest } = await import('../site/src/components/theme-configurator/suggest.ts')
  const readings = {
    themeColor: '#635bff',
    background: '#ffffff',
    text: '#1a1a1a',
    fontFamily: '"Inter", sans-serif',
    fontSize: 15,
    headingFonts: ['"Tiempos Headline", Georgia, serif'],
    buttons: [
      { bg: '#635bff', fg: '#ffffff', border: null, borderWidth: 0, radius: 6, height: 36, area: 4000, top: 200 },
      { bg: '#5851ea', fg: '#ffffff', border: null, borderWidth: 0, radius: 6, height: 36, area: 4000, top: 300 },
      { bg: '#ffffff', fg: '#1a1a1a', border: '#e0e0e0', borderWidth: 1, radius: 6, height: 36, area: 4000, top: 300 },
    ],
    surfaces: [{ color: '#0a2540', area: 400000 }, { color: '#ffb000', area: 20000 }],
    logo: ['#635bff'],
    links: ['#0a7cff', '#0a7cff'],
    inputRadii: [6],
    vars: { '--color-success': '#1ea672', '--color-danger': '#df1b41', '--spacing': '#000000' },
  }
  const brands = rankBrands(readings)
  assert.equal(brands.length, 3)
  // The button fill and its near shade merge, and win.
  assert.equal(brands[0].hex, '#635bff')
  assert.match(brands[0].source, /^Primary buttons/)
  assert.ok(brands[0].share > brands[1].share && brands[1].share >= brands[2].share)
  assert.ok(brands.every((b) => b.hex !== '#5851ea'))
  // Greys never count as brand colors.
  assert.ok(brands.every((b) => b.hex !== '#ffffff' && b.hex !== '#e0e0e0'))

  const s = suggest(readings)
  assert.equal(s.neutral.mode, 'grey')
  assert.deepEqual(s.status.seeds, { success: '#1ea672', critical: '#df1b41' })
  assert.equal(s.font.id, 'neo-grotesque')
  assert.equal(s.titles.value, 'serif')
  assert.equal(s.size.level, 1)
  assert.equal(s.corners.level, 1)
  // Pills read as Round.
  const pills = suggest({ ...readings, buttons: [{ ...readings.buttons[0], radius: 18 }] })
  assert.equal(pills.corners.level, 2)
})

test('the CSS editor marks exactly the lines it ignores', async () => {
  const { readCss } = await import('../site/src/components/theme-configurator/css-lines.ts')
  const known = new Set(['--tag-bg', '--tag-fg'])
  const text = [
    '/* toned */',
    '--tag-bg: oklch(0.9 0.05 280);',
    'color: red;',
    '--tag-unknown: 1px;',
    '--tag-fg: url(x);',
    '--tag-fg: oklch(0.4 0.1 280',
    '--tag-fg: oklch(0.3 0.1 280)',
    '--tag-bg: oklch(0.8 0.05 280);',
    'nonsense',
  ].join('\n')
  const { lines, problems } = readCss(text, known)
  // The last --tag-bg and the --tag-fg without semicolon apply.
  assert.deepEqual(lines.map((l) => [l.prop, l.value]), [['--tag-bg', 'oklch(0.8 0.05 280)'], ['--tag-fg', 'oklch(0.3 0.1 280)']])
  const messages = problems.map((p) => `${p.severity}: ${p.message}`)
  assert.ok(messages.includes('error: Only custom properties (--name) can be edited here.'))
  assert.ok(messages.includes('error: --tag-unknown is not a line of this entry, so it is ignored.'))
  assert.ok(messages.some((m) => m.startsWith('error: Values cannot contain url()')))
  assert.ok(messages.includes('error: Unbalanced parentheses.'))
  assert.ok(messages.includes('warning: Missing semicolon.'))
  assert.ok(messages.includes('warning: --tag-bg is set again below; the last one applies.'))
  assert.ok(messages.includes('error: Expected a declaration: --name: value;'))
  // Offsets point at the right text.
  const unknown = problems.find((p) => p.message.startsWith('--tag-unknown'))
  assert.equal(text.slice(unknown.from, unknown.to), '--tag-unknown')
  // Invalid colors are marked when a color check is given.
  const colors = readCss('--tag-bg: oklch(nope);', known, (v) => !v.includes('nope'))
  assert.equal(colors.problems[0].message, 'Not a valid color.')
  assert.equal(colors.lines.length, 0)
})

test('status colors follow the brand by default, relative to the base brand', async () => {
  const { harmonizedStatus } = await import('../site/src/components/theme-configurator/generate.ts')
  const { hexToOklch } = await import('../site/src/components/theme-configurator/color.ts')
  // Anta's brand gives Anta's status colors: the default theme is still empty.
  assert.equal(defaultState().status, 'brand')
  assert.equal(renderTheme(t, defaultState()), '')
  // A teal brand moves them, but each keeps its meaning (hue within 15°).
  const teal = { ...defaultState(), seeds: { ...defaultState().seeds, brand: '#0f766e' } }
  const css = renderTheme(t, teal)
  for (const tone of ['info', 'success', 'warning', 'critical']) {
    const m = new RegExp(`--anta-seed-${tone}: (#[0-9a-f]{6});`).exec(css)
    assert.ok(m, tone)
    const dh = Math.abs(((hexToOklch(m[1]).h - hexToOklch(defaultState().seeds[tone]).h + 540) % 360) - 180)
    assert.ok(dh <= 15.5, `${tone} hue moved ${dh}`)
  }
  assert.equal(harmonizedStatus('#c9302c', '#5f4bc3', '#5f4bc3'), '#c9302c')
  // Custom status colors are used as picked.
  const custom = { ...teal, status: 'custom', seeds: { ...teal.seeds, critical: '#ff0000' } }
  assert.match(renderTheme(t, custom), /--anta-seed-critical: #ff0000;/)
  // Old links with status seeds open as custom.
  assert.equal(decodeState(encodeURIComponent(JSON.stringify({ seeds: { critical: '#ff0000' } }))).status, 'custom')
})
