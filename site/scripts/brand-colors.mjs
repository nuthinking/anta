#!/usr/bin/env node
/**
 * Prints the three most likely brand colors of a website, with the evidence
 * for each. Uses the same reader and ranking as the theme configurator's
 * "From website" flow. Needs Node 24 (it imports TypeScript directly) and
 * Playwright's Chromium or an installed Google Chrome.
 *
 *   node site/scripts/brand-colors.mjs stripe.com
 *   node site/scripts/brand-colors.mjs https://linear.app --json
 */
import { checkUrl, readPage } from '../lib/theme-from-url/read-page.mjs'
import { rankBrands, suggest } from '../src/components/theme-configurator/suggest.ts'

const [input, flag] = process.argv.slice(2)
if (!input) {
  console.error('Usage: node site/scripts/brand-colors.mjs <url> [--json]')
  process.exit(1)
}
const checked = await checkUrl(input)
if (checked.error) {
  console.error(checked.error)
  process.exit(1)
}
try {
  const { url, title, readings } = await readPage(checked.url)
  const brands = rankBrands(readings)
  if (flag === '--json') {
    console.log(JSON.stringify({ url, title, brands, suggestions: suggest(readings) }, null, 2))
  } else {
    console.log(`${title} (${url})`)
    if (!brands.length) console.log('No colorful brand candidates found.')
    brands.forEach((b, i) => console.log(`${i + 1}. ${b.hex}  ${Math.round(b.share * 100)}%  ${b.source}`))
  }
  process.exit(0)
} catch (error) {
  console.error(`Could not read the website: ${String(error?.message ?? error).split('\n')[0]}`)
  process.exit(1)
}
