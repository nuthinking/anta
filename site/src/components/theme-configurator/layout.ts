/**
 * Preview sizing. Screens scale with the available width until they reach
 * actual size; past that the preview stops growing, so the configurator
 * centers in the leftover space until another column fits.
 */

/** A screen's actual width; thumbnails show it at 50–100%. */
export const DESIGN_WIDTH = 800
export const PAD = 16
export const GAP = 16

export type View = 'grid' | 'list'
export interface Layout {
  columns: number
  zoom: number
  /** Width of the preview content, padding included. */
  width: number
}

/** Smallest zoom: thumbnails never go below half size. */
const MIN_ZOOM = 0.5

export const contentWidth = (columns: number, zoom: number) =>
  columns * DESIGN_WIDTH * zoom + (columns - 1) * GAP + PAD * 2

/** Zoom that makes `columns` screens fill `available` pixels exactly. */
const fill = (columns: number, available: number) => (available - PAD * 2 - GAP * (columns - 1)) / columns / DESIGN_WIDTH

/**
 * Grid: two columns (the four screens as a 2 × 2 grid) from 50% to actual
 * size, then the preview stops growing. More columns at actual size would need
 * a window of about 3,400px for three and 4,200px for four. One column when two
 * do not fit at 50%. List: one column, 50% to 100%.
 */
export function layout(view: View, available: number): Layout {
  const columns = view === 'grid' && fill(2, available) >= MIN_ZOOM ? 2 : 1
  // Half size at least, unless even that does not fit (a phone): then the one
  // column fills the space. Floor so rounding never overflows it.
  const min = Math.min(MIN_ZOOM, fill(1, available))
  const zoom = Math.floor(Math.max(0.1, Math.min(1, Math.max(min, fill(columns, available)))) * 10000) / 10000
  return { columns, zoom, width: Math.floor(contentWidth(columns, zoom)) }
}
