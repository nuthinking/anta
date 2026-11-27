/**
 * The theme configurator on `/theming/`. Controls on the left, app screens on
 * the right (an iframe of `/theme-preview/`), and View CSS for the generated
 * file. The configurator only generates CSS; see the "Theme configurator"
 * section of `site/AGENTS.md`.
 *
 * Dial and choice positions live in the URL's `theme` parameter so a link
 * reopens the same theme; hand edits live in session storage.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Button, Icon, Tabs } from '@antadesign/anta'
import { decodeState, encodeState, stateFor, type Base, type Mode, type ThemeState } from './model.ts'
import { renderShipped, renderTheme, renderTunable } from './generate.ts'
import { templates as t, SHIPPED_THEMES, TUNABLE, seedsFor, templatesFor } from './sources.ts'
import RailTheme, { BASES } from './RailTheme.tsx'
import RailFineTune from './RailFineTune.tsx'
import ViewCssDialog from './ViewCssDialog.tsx'
import { contentWidth, layout } from './layout.ts'
import styles from './ThemeConfigurator.module.css'

const PARAM = 'theme'
/** The controls panel's fixed width. */
const PANEL_WIDTH = 300
const EDITS_KEY = 'anta-theme-configurator-edits'

// The configurator's own icon shape; its mask is in ThemeConfigurator.module.css.
declare module '@antadesign/anta' {
  interface IconShapes {
    'layout-grid': true
  }
}

/** An icon-only tab label that keeps its text for assistive technology. */
function IconLabel({ shape, text }: { shape: 'layout-grid' | 'menu' | 'sun' | 'moon'; text: string }) {
  return <span className={styles.iconLabel} title={text}><Icon shape={shape} /><span className={styles.visuallyHidden}>{text}</span></span>
}

export default function ThemeConfigurator() {
  const [state, setState] = useState<ThemeState>(() => stateFor('default'))
  const [restored, setRestored] = useState(false)
  // Bumped when seeds change from outside the color pickers, which read their value only at mount.
  const [pickerRev, setPickerRev] = useState(0)
  const [level, setLevel] = useState<'theme' | 'fine'>('theme')
  // Fine-tune opens with every entry collapsed.
  const [open, setOpen] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dark, setDark] = useState(false)
  const [cssOpen, setCssOpen] = useState(false)
  const [available, setAvailable] = useState(0)
  const [frameHeight, setFrameHeight] = useState(800)
  const frame = useRef<HTMLIFrameElement>(null)
  const outer = useRef<HTMLDivElement>(null)

  // The configurator is as wide as its panel plus the chosen preview layout,
  // centered in the space it has. Measure that space.
  useEffect(() => {
    const el = outer.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Restore in an effect, never in the useState initializer: Preact skips
  // attribute patching during hydration (see site/AGENTS.md).
  useEffect(() => {
    const raw = new URLSearchParams(location.search).get(PARAM)
    let next = raw ? decodeState(raw, seedsFor) : stateFor('default')
    try {
      const edits = JSON.parse(sessionStorage.getItem(EDITS_KEY) ?? 'null')
      if (edits && typeof edits === 'object') next = { ...next, edits }
    } catch {}
    setState(next)
    setRestored(true)
    setPickerRev((r) => r + 1)
  }, [])

  // Follow the site's light/dark switch; the toolbar can still override it.
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.classList.contains('dark'))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!restored) return
    const url = new URL(location.href)
    // URLSearchParams encodes the value itself, so give it the plain JSON.
    const encoded = decodeURIComponent(encodeState(state, seedsFor))
    if (encoded === decodeURIComponent(encodeState(stateFor('default'), seedsFor))) url.searchParams.delete(PARAM)
    else url.searchParams.set(PARAM, encoded)
    history.replaceState(history.state, '', url)
    try {
      sessionStorage.setItem(EDITS_KEY, JSON.stringify(state.edits))
    } catch {}
  }, [state, restored])

  const update = (fn: (s: ThemeState) => ThemeState) => setState(fn)
  // Default writes only what differs from Anta. A shipped base writes its
  // whole theme file, re-derived for the dials; unchanged, that is the file as shipped.
  const shipped = state.base === 'default' ? '' : SHIPPED_THEMES[state.base]
  const exported = useMemo(
    () => (state.base === 'default'
      ? renderTheme(t, state)
      : state.base === 'antera'
        ? renderTunable(t, templatesFor(state.base), state, shipped, seedsFor(state.base))
        : renderShipped(t, state, shipped, seedsFor(state.base))),
    [state],
  )
  const custom = exported !== shipped
  // The preview loads the shipped theme itself; the custom CSS replaces it when edited.
  // Antera is not a published file, so the preview always gets its CSS.
  const generated = custom || state.base === 'antera' ? exported : ''
  /** Start over from a base's own theme: colors reset, type and shape stay. */
  const startFrom = (base: Base, keepTypeAndShape: boolean) => {
    setState((s) => ({ ...stateFor(base, seedsFor(base)), ...(keepTypeAndShape ? { type: s.type, corners: s.corners } : {}) }))
    setPickerRev((r) => r + 1)
  }
  const mode: Mode = dark ? 'dark' : 'light'
  const baseLabel = BASES.find((b) => b.id === state.base)!.label
  const family = level === 'fine' ? open : null

  const post = () => frame.current?.contentWindow?.postMessage(
    { type: 'anta-theme-preview', theme: state.base === 'default' ? 'none' : state.base, dark, css: generated, view, family },
    location.origin,
  )
  useEffect(post, [generated, dark, view, family, state.base])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === 'anta-theme-preview-ready') post()
      // The preview never scrolls: the iframe takes its content's height.
      if (event.data?.type === 'anta-theme-preview-size' && Number.isFinite(event.data.height)) setFrameHeight(Math.max(200, event.data.height))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  })

  // Side by side while the panel and a one-column preview at 75% fit; stacked below that.
  const sideBySide = available >= PANEL_WIDTH + contentWidth(1, 0.75) + 1
  const preview = layout(view, sideBySide ? available - PANEL_WIDTH - 1 : available - 2)
  const width = available ? (sideBySide ? PANEL_WIDTH + preview.width + 1 : preview.width + 2) : undefined

  return (
    <div ref={outer} className={styles.outer}>
    <div className={sideBySide ? styles.configurator : `${styles.configurator} ${styles.stacked}`} style={width ? { width: `${width}px` } : undefined}>
      <aside className={styles.panel} aria-label="Theme controls">
        {level === 'theme'
          ? <RailTheme state={state} update={update} pickerRev={pickerRev} onBase={(base) => startFrom(base, true)}
            onWebsite={(change) => {
              setState(change)
              setPickerRev((r) => r + 1)
            }} />
          : <RailFineTune state={state} update={update} mode={mode} open={open} onOpen={setOpen} onBack={() => setLevel('theme')} />}
        {/* One stack of buttons 8px apart. */}
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            {level === 'theme' && <Button tone="brand" priority="secondary" className={styles.footerButton} disabled={!TUNABLE.includes(state.base)} onClick={() => setLevel('fine')}>Fine-tune per component</Button>}
            <Button tone="brand" priority="primary" className={styles.footerButton} onClick={() => setCssOpen(true)}>View CSS</Button>
            {/* Why Fine-tune is disabled on Antune and Antithesis. */}
            {level === 'theme' && !TUNABLE.includes(state.base) && <p className={`${styles.hint} ${styles.footerNote}`}>This theme can't be fine-tuned.</p>}
            {custom && <Button priority="quaternary" size="small" className={styles.footerButton} onClick={() => startFrom(state.base, false)}>Reset theme</Button>}
          </div>
        </div>
      </aside>
      <section className={styles.preview} aria-label="Theme preview">
        {/* The toolbar floats over the preview, so it takes the preview's color mode, not the page's. */}
        <div className={`${styles.toolbar} ${dark ? 'dark' : 'light'}`}>
          <Tabs size="small" label="Preview layout" value={view}
            options={[
              { value: 'grid', label: <IconLabel shape="layout-grid" text="Grid" /> },
              { value: 'list', label: <IconLabel shape="menu" text="List" /> },
            ]}
            onStateChange={(_e: unknown, d: { next: string | null }) => d.next && setView(d.next as 'grid' | 'list')} />
          <Tabs size="small" label="Preview color mode" value={mode}
            options={[
              { value: 'light', label: <IconLabel shape="sun" text="Light" /> },
              { value: 'dark', label: <IconLabel shape="moon" text="Dark" /> },
            ]}
            onStateChange={(_e: unknown, d: { next: string | null }) => d.next && setDark(d.next === 'dark')} />
        </div>
        <iframe ref={frame} src="/theme-preview/" title={`Theme preview: app screens${custom ? `, custom theme based on ${baseLabel}` : `, ${baseLabel}`}`}
          className={styles.frame} style={{ height: `${frameHeight}px`, ...(available ? { width: `${preview.width}px` } : {}) }} />
      </section>
      <ViewCssDialog open={cssOpen} onOpenChange={setCssOpen} css={exported} base={state.base} custom={custom} />
    </div>
    </div>
  )
}
