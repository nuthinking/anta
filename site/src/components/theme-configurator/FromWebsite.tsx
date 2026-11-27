/**
 * "From website": reads a site through the dev server's headless browser and
 * suggests a brand color (three candidates) and values for the other controls.
 * Development only: the deployed docs have no server to read websites, so
 * RailTheme renders this only when `import.meta.env.DEV` is true.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { Banner, Button, Checkbox, Dialog, Input, RadioGroup, Text } from '@antadesign/anta'
import { FONTS, type ThemeState } from './model.ts'
import { suggest, type Readings, type Suggestions } from './suggest.ts'
import { STATUS_TONES, harmonizedStatus } from './generate.ts'
import { seedsFor } from './sources.ts'
import styles from './ThemeConfigurator.module.css'

const ENDPOINT = '/api/theme-from-url/'
const LEVELS = { size: ['Small', 'Regular', 'Large'], corners: ['Square', 'Soft', 'Round'] } as const

type Optional = 'neutral' | 'status' | 'font' | 'titles' | 'size' | 'corners'

interface Result { url: string; title: string; screenshot: string; suggestions: Suggestions }

/** Applies the chosen suggestions to a state. Exported for the parent, which also owns the preview mode. */
export function applySuggestions(state: ThemeState, s: Suggestions, brand: string | null, picked: Set<Optional>): ThemeState {
  const next: ThemeState = { ...state, seeds: { ...state.seeds }, type: { ...state.type } }
  if (brand) next.seeds.brand = brand
  if (picked.has('neutral') && s.neutral) {
    next.neutral = s.neutral.mode
    if (s.neutral.hex) next.seeds.neutral = s.neutral.hex
  }
  // The site's status colors replace the ones following the brand.
  if (picked.has('status') && s.status) {
    // Tones the site does not name keep the colors that follow the (new) brand.
    if (next.status === 'brand') {
      const own = seedsFor(next.base)
      for (const tone of STATUS_TONES) next.seeds[tone] = harmonizedStatus(own[tone], next.seeds.brand, own.brand)
    }
    next.status = 'custom'
    Object.assign(next.seeds, s.status.seeds)
  }
  if (picked.has('font') && s.font) next.type.font = s.font.id
  if (picked.has('titles') && s.titles) next.type.titles = s.titles.value
  if (picked.has('size') && s.size) next.type.size = s.size.level
  if (picked.has('corners') && s.corners) next.corners = s.corners.level
  return next
}

function Swatch({ hex }: { hex: string }) {
  return <span className={styles.swatchSmall} style={{ background: hex }} />
}

export default function FromWebsite({ open, onOpenChange, onApply }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (change: (s: ThemeState) => ThemeState) => void
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<Optional>>(new Set())

  // Every opening starts empty. Resetting on open, not on close, keeps the
  // previous content visible while the dialog animates out.
  // Bumped on every opening, so a read still running from a previous opening is dropped.
  const session = useRef(0)
  useEffect(() => {
    if (!open) return
    session.current++
    setUrl('')
    setLoading(false)
    setError(null)
    setResult(null)
    setBrand(null)
    setPicked(new Set())
  }, [open])

  const read = async () => {
    if (!url.trim() || loading) return
    const mine = session.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      const body = await res.json().catch(() => ({ error: res.status === 404 ? 'Reading websites needs the local dev server.' : 'Unexpected response.' }))
      if (mine !== session.current) return
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`)
      const suggestions = suggest(body.readings as Readings)
      setResult({ url: body.url, title: body.title, screenshot: body.screenshot, suggestions })
      setBrand(suggestions.brands[0]?.hex ?? null)
      // Everything found starts picked; status only when the site names its status colors.
      setPicked(new Set((['neutral', 'status', 'font', 'titles', 'size', 'corners'] as Optional[]).filter((k) => suggestions[k])))
    } catch (e) {
      if (mine !== session.current) return
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (mine === session.current) setLoading(false)
    }
  }

  const toggle = (key: Optional, on: boolean) => setPicked((p) => {
    const next = new Set(p)
    if (on) next.add(key)
    else next.delete(key)
    return next
  })

  const s = result?.suggestions
  const rows: { key: Optional; label: string; value: any; source: string }[] = s ? [
    s.neutral && { key: 'neutral' as const, label: 'Neutral', value: s.neutral.hex ? <><Swatch hex={s.neutral.hex} /> Custom</> : 'Grey', source: s.neutral.source },
    s.status && { key: 'status' as const, label: 'Status', value: <>{Object.values(s.status.seeds).map((hex) => <Swatch key={hex} hex={hex!} />)}</>, source: s.status.source },
    s.font && { key: 'font' as const, label: 'Font', value: FONTS.find((f) => f.id === s.font!.id)!.label, source: s.font.source },
    s.titles && { key: 'titles' as const, label: 'Titles', value: s.titles.value === 'serif' ? 'Serif' : 'Sans', source: s.titles.source },
    s.size && { key: 'size' as const, label: 'Text size', value: LEVELS.size[s.size.level], source: s.size.source },
    s.corners && { key: 'corners' as const, label: 'Corners', value: LEVELS.corners[s.corners.level], source: s.corners.source },
  ].filter(Boolean) as any : []

  const apply = () => {
    if (!s) return
    const sug = s
    onApply((state) => applySuggestions(state, sug, brand, picked))
    onOpenChange(false)
  }

  return (
    <Dialog
      className={styles.websiteDialog}
      open={open}
      onStateChange={(_e: unknown, d: { next: boolean }) => onOpenChange(d.next)}
      header="Theme from a website"
      footer={
        <div className={styles.dialogFooter}>
          <span />
          <Button priority="quaternary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button tone="brand" priority="primary" disabled={!s} onClick={apply}>Apply</Button>
        </div>
      }
    >
      <div className={styles.fromWebsite}>
        <div className={styles.fromWebsiteRow}>
          <Input size="medium" aria-label="Website address" placeholder="example.com" value={url} disabled={loading}
            onInput={(e: any) => setUrl(e.target.value)}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') read() }} />
          <Button priority="secondary" loading={loading} disabled={!url.trim()} onClick={read}>Read</Button>
        </div>
        {error && <Banner tone="critical" message={error} />}
        {result && s && (
          <div className={styles.fromWebsiteResult}>
            <img className={styles.fromWebsiteShot} src={result.screenshot} alt={`Screenshot of ${result.title || result.url}`} />
            <div className={styles.fromWebsiteList}>
              {s.brands.length ? (
                <RadioGroup label="Brand" value={brand ?? ''} onStateChange={(_e: unknown, d: { next: string | null }) => setBrand(d.next)}
                  options={s.brands.map((b) => ({
                    value: b.hex,
                    label: <span className={styles.candidate}><Swatch hex={b.hex} />{b.hex}<Text size="small" priority="tertiary">{Math.round(b.share * 100)}%</Text></span>,
                    hint: b.source,
                  }))} />
              ) : <Text size="small" priority="tertiary">No colorful brand color found; Brand stays as it is.</Text>}
              {rows.map((row) => (
                <Checkbox key={row.key} checked={picked.has(row.key)} hint={row.source}
                  onStateChange={(_e: unknown, d: { next: unknown }) => toggle(row.key, d.next === true)}>
                  <span className={styles.candidate}>{row.label}: {row.value}</span>
                </Checkbox>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
