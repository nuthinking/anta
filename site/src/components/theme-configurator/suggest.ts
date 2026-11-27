/**
 * Turns styles read from a website (`site/lib/theme-from-url/read-page.mjs`)
 * into suggestions for the configurator's controls. Pure, so it runs in tests.
 * Each suggestion says where it was read, so people can judge it before applying.
 */
import type { Tone } from '../theming-lab-formulas.ts'
import { hexToOklch, oklchToHex } from './color.ts'
import type { FontId, Level, NeutralMode } from './model.ts'

export interface Readings {
  themeColor: string | null
  background: string
  text: string | null
  fontFamily: string
  fontSize: number
  headingFonts: string[]
  buttons: { bg: string | null; fg: string | null; border: string | null; borderWidth: number; radius: number; height: number; area: number; top: number }[]
  /** Colored backgrounds in the first two screens, with their area. */
  surfaces: { color: string; area: number }[]
  /** Fills and strokes of SVG shapes in the header and logo. */
  logo: string[]
  links: string[]
  inputRadii: number[]
  vars: Record<string, string>
}

export type SuggestionId = 'neutral' | 'status' | 'font' | 'titles' | 'size' | 'corners'

/** A likely brand color: `share` is its part of all the brand evidence, 0 to 1. */
export interface BrandCandidate { hex: string; share: number; source: string }

export interface Suggestions {
  /** Up to three likely brand colors, most likely first. */
  brands: BrandCandidate[]
  neutral?: { mode: NeutralMode; hex?: string; source: string }
  status?: { seeds: Partial<Record<Exclude<Tone, 'neutral' | 'brand'>, string>>; source: string }
  font?: { id: FontId; source: string }
  titles?: { value: 'sans' | 'serif'; source: string }
  size?: { level: Level; source: string }
  corners?: { level: Level; source: string }
}

/** Colorful enough to be a brand or status color. */
const CHROMATIC = 0.06
const chroma = (hex: string) => hexToOklch(hex).c

/** The first family in a font-family list, unquoted. */
const firstFamily = (list: string) => (list.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '')

const FONT_GROUPS: { id: FontId; pattern: RegExp }[] = [
  { id: 'system', pattern: /^(system-ui|-apple-system|blinkmacsystemfont|sf pro|segoe ui variable)/i },
  { id: 'geometric', pattern: /(avenir|montserrat|futura|poppins|gotham|century gothic|proxima|circular|geist|manrope|dm sans|outfit|urbanist)/i },
  { id: 'humanist', pattern: /(gill sans|source sans|open sans|lato|segoe|calibri|ubuntu|fira sans|noto sans|myriad|frutiger|seravek|ibm plex sans)/i },
  { id: 'neo-grotesque', pattern: /(inter|roboto|helvetica|arial|nimbus|söhne|sohne|graphik|aktiv|haas|untitled sans|work sans)/i },
]
const SERIF = /(serif|georgia|times|garamond|merriweather|playfair|lora|tiempos|freight|charter|source serif|baskerville|caslon)/i
const isSerifList = (list: string) => SERIF.test(firstFamily(list)) && !/sans/i.test(firstFamily(list))

/** Weight of each kind of evidence for the brand color. */
const BRAND_SOURCES = {
  buttons: { weight: 5, label: 'primary buttons' },
  vars: { weight: 4, label: 'CSS variables' },
  themeColor: { weight: 3, label: 'theme-color meta tag' },
  logo: { weight: 3, label: 'logo and header icons' },
  surfaces: { weight: 2, label: 'large colored areas' },
  links: { weight: 2, label: 'links' },
} as const
type BrandSource = keyof typeof BRAND_SOURCES

/** Colors closer than this in OKLab count as one brand color (a button and its hover shade). */
const SAME_COLOR = 0.06

const lab = (hex: string) => {
  const { l, c, h } = hexToOklch(hex)
  return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
}
const distance = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a)
  const [l2, a2, b2] = lab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/**
 * The three most likely brand colors. Each source spreads its weight over the
 * chromatic colors it found, in proportion to how much each appears; similar
 * colors are merged, and the strongest member of each cluster represents it.
 */
export function rankBrands(r: Readings, limit = 3): BrandCandidate[] {
  const evidence: { hex: string; score: number; source: BrandSource }[] = []
  const spread = (source: BrandSource, entries: [string, number][]) => {
    const usable = entries.filter(([hex, w]) => w > 0 && chroma(hex) >= CHROMATIC)
    const total = usable.reduce((sum, [, w]) => sum + w, 0)
    for (const [hex, w] of usable) evidence.push({ hex, score: (BRAND_SOURCES[source].weight * w) / total, source })
  }
  spread('buttons', r.buttons.flatMap((b) => {
    // Solid buttons by their fill, outlined ones by their border; buttons in the first screen count double.
    const color = b.bg && chroma(b.bg) >= CHROMATIC ? b.bg : b.borderWidth >= 1 && b.border ? b.border : null
    return color ? [[color, Math.sqrt(b.area) * (b.top < 800 ? 2 : 1)] as [string, number]] : []
  }))
  spread('vars', Object.entries(r.vars).filter(([name]) => /(brand|primary|accent)/i.test(name)).map(([name, hex]) => [hex, /(brand|primary)/i.test(name) ? 2 : 1]))
  if (r.themeColor) spread('themeColor', [[r.themeColor, 1]])
  spread('logo', r.logo.map((hex) => [hex, 1]))
  spread('surfaces', r.surfaces.map((s) => [s.color, Math.sqrt(s.area)]))
  spread('links', r.links.map((hex) => [hex, 1]))

  const clusters: { members: typeof evidence; score: number }[] = []
  for (const e of [...evidence].sort((a, b) => b.score - a.score)) {
    const home = clusters.find((c) => distance(c.members[0].hex, e.hex) < SAME_COLOR)
    if (home) {
      home.members.push(e)
      home.score += e.score
    } else clusters.push({ members: [e], score: e.score })
  }
  const total = clusters.reduce((sum, c) => sum + c.score, 0)
  return clusters
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => {
      // Represent the cluster by its single strongest color, and name its sources by contribution.
      const bySource = new Map<BrandSource, number>()
      for (const m of c.members) bySource.set(m.source, (bySource.get(m.source) ?? 0) + m.score)
      const sources = [...bySource].sort((a, b) => b[1] - a[1]).map(([s]) => BRAND_SOURCES[s].label)
      const hex = [...c.members].sort((a, b) => b.score - a.score)[0].hex
      return { hex, share: c.score / total, source: sources.join(', ').replace(/^./, (ch) => ch.toUpperCase()) }
    })
}

const varFor = (vars: Record<string, string>, pattern: RegExp) => {
  const hit = Object.entries(vars).find(([name, value]) => pattern.test(name) && chroma(value) >= CHROMATIC)
  return hit ? { hex: hit[1], name: hit[0] } : null
}

export function suggest(r: Readings): Suggestions {
  const out: Suggestions = { brands: rankBrands(r) }

  // Neutral: pure greys stay grey; a tinted page gives a custom neutral at Anta's neutral lightness.
  const bg = hexToOklch(r.background)
  const text = r.text ? hexToOklch(r.text) : null
  const tint = text && text.c > bg.c ? text : bg
  if (tint.c < 0.008) out.neutral = { mode: 'grey', source: 'Page background and text are pure grey' }
  else {
    const hex = oklchToHex({ l: 0.48, c: Math.min(0.04, Math.max(0.012, tint.c)), h: tint.h })
    out.neutral = { mode: 'custom', hex, source: `Page ${tint === text ? 'text' : 'background'} tint` }
  }

  // Status: only colors the site names itself.
  const status: NonNullable<Suggestions['status']>['seeds'] = {}
  const names: string[] = []
  for (const [tone, pattern] of [['success', /success/i], ['warning', /warning/i], ['critical', /(danger|error|critical)/i], ['info', /info/i]] as const) {
    const hit = varFor(r.vars, pattern)
    if (hit) {
      status[tone] = hit.hex
      names.push(hit.name)
    }
  }
  if (names.length) out.status = { seeds: status, source: `CSS variables ${names.join(', ')}` }

  // Type.
  const family = firstFamily(r.fontFamily)
  const group = FONT_GROUPS.find((g) => g.pattern.test(family))
  if (group) out.font = { id: group.id, source: `Body font ${family}` }
  const heading = r.headingFonts[0]
  if (heading) out.titles = isSerifList(heading) ? { value: 'serif', source: `Heading font ${firstFamily(heading)}` } : { value: 'sans', source: `Heading font ${firstFamily(heading)}` }
  const px = r.fontSize
  out.size = { level: px <= 14 ? 0 : px >= 17 ? 2 : 1, source: `Body text ${Math.round(px * 10) / 10}px` }

  // Corners: the median radius of buttons and fields, against their height for pills.
  const radii = [
    ...r.buttons.filter((b) => b.bg || b.borderWidth).map((b) => (b.radius >= b.height / 2 - 1 ? 999 : b.radius)),
    ...r.inputRadii,
  ].sort((a, b) => a - b)
  if (radii.length) {
    const median = radii[Math.floor(radii.length / 2)]
    out.corners = { level: median <= 3 ? 0 : median >= 10 ? 2 : 1, source: median === 999 ? 'Pill-shaped buttons' : `Button and field corners ${Math.round(median)}px` }
  }

  return out
}
