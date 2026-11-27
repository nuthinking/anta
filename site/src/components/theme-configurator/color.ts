/**
 * Minimal OKLCH helpers for contrast checks. Conversions follow Björn
 * Ottosson's OKLab definition. Out-of-gamut colors are clipped per channel,
 * which is close enough for a contrast estimate.
 */

export interface Oklch { l: number; c: number; h: number }

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

export function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.slice(1, 7), 16)
  const r = toLinear(((n >> 16) & 255) / 255)
  const g = toLinear(((n >> 8) & 255) / 255)
  const b = toLinear((n & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(a, B), h: ((Math.atan2(B, a) * 180) / Math.PI + 360) % 360 }
}

/** Relative luminance (WCAG) of an OKLCH color, clipped to sRGB. */
export function luminance({ l: L, c, h }: Oklch): number {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (v: number) => Math.min(1, Math.max(0, v))
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

/** WCAG contrast ratio of white text on the color. */
export const contrastWithWhite = (color: Oklch) => 1.05 / (luminance(color) + 0.05)

/** Highest lightness at or below `l` where white text keeps `ratio` contrast. */
export function lightnessForWhiteText(color: Oklch, ratio = 4.5): number {
  if (contrastWithWhite(color) >= ratio) return color.l
  let lo = 0
  let hi = color.l
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (contrastWithWhite({ ...color, l: mid }) >= ratio) lo = mid
    else hi = mid
  }
  return lo
}

const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

/** Linear sRGB channels of an OKLCH color, unclipped. */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/**
 * A `#rrggbb` (or `#rrggbbaa` when `alpha` is below 1) hex for an OKLCH color.
 * Out-of-gamut colors lose chroma at the same lightness and hue until they fit.
 */
export function oklchToHex(color: Oklch, alpha = 1): string {
  let rgb = oklchToLinear(color)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = color.c
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid
      else hi = mid
    }
    rgb = oklchToLinear({ ...color, c: lo })
  }
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  const hex = `#${rgb.map((v) => byte(toGamma(Math.min(1, Math.max(0, v))))).join('')}`
  return alpha < 1 ? hex + byte(alpha) : hex
}
