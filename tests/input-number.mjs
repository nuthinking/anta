import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script, css

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { h, render } from 'preact'
        import { useState } from 'preact/hooks'
        import { configure } from './src/jsx-runtime'
        import { InputNumber } from './src/components/InputNumber'
        import './src/elements/a-input'
        import './src/tokens.css'
        window.events = []
        const log = id => (event, attrs) => window.events.push([id, event.type, attrs.value])
        function Controlled() {
          const [value, setValue] = useState(1)
          window.controlled = value
          return h(InputNumber, { id: 'controlled', label: 'Controlled', step: 0.5, value,
            onValueChange: (_event, attrs) => setValue(attrs.value) })
        }
        configure(h)
        render(h('main', { style: 'display: grid; gap: 16px; width: 240px; padding: 40px' },
          h(InputNumber, { id: 'plain', label: 'Plain', defaultValue: 10, onValueChange: log('plain') }),
          h(InputNumber, { id: 'bounded', label: 'Bounded', defaultValue: 0.5, min: 0, max: 1, step: 0.01, onValueChange: log('bounded') }),
          h(Controlled),
          h(InputNumber, { id: 'bare', label: 'Bare', defaultValue: 3, scrub: false, steppers: false }),
          h(InputNumber, { id: 'disabled', label: 'Disabled', defaultValue: 3, disabled: true }),
        ), document.body)
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    outfile: 'input-number.js',
    format: 'iife',
    target: 'es2022',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

async function open(t) {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  return page
}

const value = (page, id) => page.locator(`#${id}`).evaluate(host => host.value)
const focused = (page, id) => page.locator(`#${id}`).evaluate(host => host.shadowRoot.activeElement?.getAttribute('part') === 'input')
const events = (page, id) => page.evaluate(id => window.events.filter(entry => entry[0] === id).map(entry => entry.slice(1)), id)

/** Press on the field's text area and move horizontally by each offset in turn. */
async function drag(page, id, offsets, options = {}) {
  const box = await page.locator(`#${id} [part="input"]`).boundingBox()
  const x = box.x + 20
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  if (options.modifier) await page.keyboard.down(options.modifier)
  for (const offset of offsets) await page.mouse.move(x + offset, y)
  if (options.modifier) await page.keyboard.up(options.modifier)
  await page.mouse.up()
}

test('InputNumber scrubs by step on a horizontal drag', async (t) => {
  const page = await open(t)

  // 3px arms the scrub; every 2px after that is one step.
  await drag(page, 'plain', [3, 13, 23])
  assert.equal(await value(page, 'plain'), '20')
  assert.equal(await focused(page, 'plain'), false)
  const plain = await events(page, 'plain')
  assert.deepEqual(plain.at(-1), ['change', 20])
  assert.deepEqual(plain.at(-2), ['input', 20])
  assert.equal(plain.filter(entry => entry[0] === 'change').length, 1)

  await drag(page, 'plain', [-3, -9])
  assert.equal(await value(page, 'plain'), '17')

  await drag(page, 'plain', [3, 7], { modifier: 'Shift' })
  assert.equal(await value(page, 'plain'), '37')
})

test('InputNumber scrubbing stops at the bounds and keeps step precision', async (t) => {
  const page = await open(t)

  await drag(page, 'bounded', [3, 9])
  assert.equal(await value(page, 'bounded'), '0.53')
  await drag(page, 'bounded', [3, 400])
  assert.equal(await value(page, 'bounded'), '1')
  await drag(page, 'bounded', [-3, -900])
  assert.equal(await value(page, 'bounded'), '0')
  assert.deepEqual((await events(page, 'bounded')).at(-1), ['change', 0])
})

test('InputNumber focuses for typing on a click and keeps a typed draft', async (t) => {
  const page = await open(t)

  await page.locator('#plain [part="input"]').click({ position: { x: 20, y: 8 } })
  assert.equal(await focused(page, 'plain'), true)
  assert.equal(await value(page, 'plain'), '10')
  // The click selected the whole value, so typing replaces it.
  await page.keyboard.type('42')
  assert.equal(await value(page, 'plain'), '42')
  // A focused field edits text: a drag does not scrub.
  await drag(page, 'plain', [3, 23])
  assert.equal(await value(page, 'plain'), '42')

  // "2." is not a number yet, so the application holds null. The controlled
  // field keeps the draft so the next digit completes it.
  await page.locator('#controlled [part="input"]').click({ position: { x: 20, y: 8 } })
  await page.keyboard.type('2.')
  assert.equal(await page.evaluate(() => window.controlled), null)
  await page.keyboard.type('5')
  assert.equal(await value(page, 'controlled'), '2.5')
  assert.equal(await page.evaluate(() => window.controlled), 2.5)
  await page.keyboard.press('ArrowUp')
  assert.equal(await page.evaluate(() => window.controlled), 3)
})

test('InputNumber steps with its buttons', async (t) => {
  const page = await open(t)

  await page.locator('#plain [part~="step-up"]').click()
  assert.equal(await value(page, 'plain'), '11')
  assert.deepEqual((await events(page, 'plain')).slice(-2), [['input', 11], ['change', 11]])
  assert.equal(await focused(page, 'plain'), false)
  await page.locator('#plain [part~="step-down"]').click({ modifiers: ['Shift'] })
  assert.equal(await value(page, 'plain'), '1')

  await page.locator('#controlled [part~="step-up"]').click()
  assert.equal(await page.evaluate(() => window.controlled), 1.5)

  // Holding a button repeats after a delay.
  const up = await page.locator('#plain [part~="step-up"]').boundingBox()
  await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2)
  await page.mouse.down()
  await page.waitForFunction(() => Number(document.querySelector('#plain').value) >= 4)
  await page.mouse.up()
  const held = Number(await value(page, 'plain'))
  await page.waitForTimeout(200)
  assert.equal(Number(await value(page, 'plain')), held)
})

test('InputNumber turns scrubbing and step buttons off', async (t) => {
  const page = await open(t)

  assert.equal(await page.locator('#bare [part="steppers"]').count(), 0)
  await drag(page, 'bare', [3, 23])
  assert.equal(await value(page, 'bare'), '3')
  assert.equal(await focused(page, 'bare'), true)

  assert.equal(await page.locator('#disabled [part="steppers"]').count(), 1)
  await drag(page, 'disabled', [3, 23])
  await page.locator('#disabled [part~="step-up"]').click({ force: true })
  assert.equal(await value(page, 'disabled'), '3')
})
