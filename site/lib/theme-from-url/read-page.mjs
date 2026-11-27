/**
 * Renders a website in headless Chrome and reads the styles the theme
 * configurator can turn into suggestions. Development only: the deployed docs
 * are static and have no server to run this (see site/AGENTS.md).
 *
 * The browser reads computed styles from real elements, which finds colors
 * that utility classes and bundled CSS hide from a plain HTML fetch.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const NAV_TIMEOUT = 20_000

/** Private, loopback and link-local addresses: the dev server must not proxy into the local network. */
function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const v6 = address.toLowerCase()
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:127.') || v6.startsWith('::ffff:10.') || v6.startsWith('::ffff:192.168.')
}

/** A public http(s) URL, or an error message. */
export async function checkUrl(raw) {
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { error: 'That is not a valid address.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'Use an http or https address.' }
  if (url.username || url.password) return { error: 'Addresses with credentials are not supported.' }
  try {
    const addresses = await lookup(url.hostname, { all: true })
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) return { error: 'Only public websites can be read.' }
  } catch {
    return { error: `Could not find ${url.hostname}.` }
  }
  return { url: url.href }
}

let browserPromise = null
async function browser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright')
    // Playwright's own Chromium when installed, otherwise the system Chrome the tests use.
    browserPromise = chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: 'chrome' }))
    browserPromise.catch(() => { browserPromise = null })
  }
  return browserPromise
}

/** Runs in the page: computed styles of representative elements, colors as hex. */
function collect() {
  const canvas = document.createElement('canvas').getContext('2d')
  // Normalize any CSS color (rgb, oklch, named) to #rrggbb, or null when transparent or invalid.
  const hex = (value) => {
    if (!value || value === 'transparent') return null
    const alpha = /rgba?\([^)]*,\s*([\d.]+)\)|\/\s*([\d.]+%?)\s*\)/.exec(value)
    if (alpha) {
      const a = alpha[1] ?? alpha[2]
      if (parseFloat(a) / (a.endsWith('%') ? 100 : 1) < 0.5) return null
    }
    canvas.fillStyle = '#010203'
    canvas.fillStyle = value
    const out = canvas.fillStyle
    if (out === '#010203' && value.replace(/\s/g, '') !== '#010203') return null
    return /^#[0-9a-f]{6}$/i.test(out) ? out.toLowerCase() : null
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 8 && r.height > 8 && r.top < innerHeight * 3 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5
  }
  const backgroundOf = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const c = hex(getComputedStyle(node).backgroundColor)
      if (c) return c
    }
    return '#ffffff'
  }
  const sample = (selector, limit) => [...document.querySelectorAll(selector)].filter(visible).slice(0, limit)

  const body = document.body
  const bodyStyle = getComputedStyle(body)
  const buttons = sample('button, [role="button"], input[type="submit"], a[class*="btn" i], a[class*="button" i]', 40).map((el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { bg: hex(cs.backgroundColor), fg: hex(cs.color), border: hex(cs.borderTopColor), borderWidth: parseFloat(cs.borderTopWidth) || 0, radius: parseFloat(cs.borderTopLeftRadius) || 0, height: r.height, area: r.width * r.height, top: r.top }
  })
  const links = sample('main a, article a, p a, nav a, a', 60).map((el) => hex(getComputedStyle(el).color)).filter(Boolean)
  const inputs = sample('input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea, select', 10).map((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
  const headings = sample('h1, h2', 4).map((el) => getComputedStyle(el).fontFamily)

  // Large colored areas in the first screens: hero, header, banners, cards.
  const surfaces = []
  for (const el of [...document.querySelectorAll('body *')].slice(0, 4000)) {
    const c = hex(getComputedStyle(el).backgroundColor)
    if (!c || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.top > innerHeight * 2) continue
    surfaces.push({ color: c, area: r.width * r.height })
  }
  // Logo and header icon colors: fills and strokes of SVG shapes near the top.
  const logo = []
  for (const el of document.querySelectorAll('header svg *, nav svg *, [class*="logo" i] svg *, svg[class*="logo" i] *, a[href="/"] svg *')) {
    if (logo.length >= 60) break
    const cs = getComputedStyle(el)
    for (const value of [cs.fill, cs.stroke]) {
      const c = value && value !== 'none' ? hex(value) : null
      if (c) logo.push(c)
    }
  }

  // Custom properties declared on :root in readable stylesheets, with brand-like or status-like names.
  const vars = {}
  const rootStyle = getComputedStyle(document.documentElement)
  const NAME = /(brand|primary|accent|success|danger|error|critical|warning|info)/i
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }
    for (const rule of rules ?? []) {
      if (!rule.style || !/(^|,)\s*(:root|html)\b/.test(rule.selectorText ?? '')) continue
      for (const name of rule.style) {
        if (!name.startsWith('--') || !NAME.test(name) || Object.keys(vars).length >= 80) continue
        const c = hex(rootStyle.getPropertyValue(name).trim())
        if (c) vars[name] = c
      }
    }
  }

  return {
    themeColor: hex(document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? ''),
    background: backgroundOf(body),
    text: hex(bodyStyle.color),
    fontFamily: bodyStyle.fontFamily,
    fontSize: parseFloat(bodyStyle.fontSize) || 16,
    headingFonts: headings,
    surfaces,
    logo,
    buttons,
    links,
    inputRadii: inputs,
    vars,
  }
}

/** Renders `url` and returns the raw readings plus a small screenshot (data URL). */
export async function readPage(url) {
  const b = await browser()
  const context = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', javaScriptEnabled: true })
  // Block requests that would reach the local network, including after redirects.
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname
    if (host === 'localhost' || (isIP(host) && isPrivateAddress(host))) return route.abort()
    return route.continue()
  })
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    const readings = await page.evaluate(collect)
    const shot = await page.screenshot({ type: 'jpeg', quality: 55 })
    return { url: page.url(), title: await page.title(), readings, screenshot: `data:image/jpeg;base64,${shot.toString('base64')}` }
  } finally {
    await context.close()
  }
}
