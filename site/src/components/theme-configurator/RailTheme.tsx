/** Level 1: the theme dials. */
import { useState } from 'preact/hooks'
import { Button, Select, Tabs } from '@antadesign/anta'
import ColorPicker from '../ColorPicker'
import FromWebsite from './FromWebsite.tsx'
import { ALL, FONTS, levelOf, type Base, type FontId, type Level, type ThemeState } from './model.ts'
import { intensityLevel, setIntensity } from './match.ts'
import { Field, Seg, type Update } from './controls.tsx'
import { templates as t, seedsFor } from './sources.ts'
import { effectiveSeeds, harmonizedStatus, scaleChroma } from './generate.ts'
import { chromaFactor } from './presets.ts'
import styles from './ThemeConfigurator.module.css'

export const BASES: { id: Base; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'antune', label: 'Antune' },
  { id: 'antithesis', label: 'Antithesis' },
]
const STATUS = ['info', 'success', 'warning', 'critical'] as const

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.sectionHeader}>{title}</h3>
      <div className={styles.form}>{children}</div>
    </section>
  )
}

export default function RailTheme({ state, update, onBase, onWebsite, pickerRev }: {
  state: ThemeState
  update: Update
  /** Switch base: its own colors replace the current ones. */
  onBase: (base: Base) => void
  /** Applies suggestions read from a website. */
  onWebsite: (change: (s: ThemeState) => ThemeState) => void
  /** Changes when seeds change from outside the pickers, so they remount with the new value. */
  pickerRev: number
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [websiteOpen, setWebsiteOpen] = useState(false)
  const shipped = state.base !== 'default'
  const baseLabel = BASES.find((b) => b.id === state.base)!.label
  const [statusRev, setStatusRev] = useState(0)
  const own = seedsFor(state.base)
  const inUse = effectiveSeeds(state, own)
  const isStatus = (tone: string): tone is (typeof STATUS)[number] => (STATUS as readonly string[]).includes(tone)
  /** A status color following the brand, before Intensity. */
  const following = (tone: (typeof STATUS)[number], brand: string) => harmonizedStatus(own[tone], brand, own.brand)
  // Intensity scales the brand and status colors. Pickers show and set the color in use;
  // the state keeps it with Intensity taken out, so Balanced shows the base color again.
  const intensity = levelOf(state, ALL, 'color')
  const k = chromaFactor(intensity)
  const toBase = (tone: keyof ThemeState['seeds'], hex: string) => (tone === 'neutral' || k === 1 ? hex : scaleChroma(hex, 1 / k))
  const pickerValue = (tone: keyof ThemeState['seeds']) => (tone === 'neutral' ? state.seeds.neutral : inUse[tone])
  /**
   * Pickers read their value at mount: status pickers remount when the brand
   * changes (they may follow it) or after Reset. The key ignores the status
   * mode, so the first edit, which switches to custom, does not remount mid-drag.
   */
  const pickerKey = (tone: keyof ThemeState['seeds']) =>
    isStatus(tone) ? `${tone}:${pickerRev}:${statusRev}:${intensity}:${state.seeds.brand}` : `${tone}:${pickerRev}:${tone === 'brand' ? intensity : ''}`

  const setSeed = (tone: keyof ThemeState['seeds'], picked: string) => update((s) => {
    const hex = toBase(tone, picked)
    // The first status edit overrides all four, starting from the colors following the brand.
    if (isStatus(tone) && s.status === 'brand') {
      const seeds = { ...s.seeds, ...Object.fromEntries(STATUS.map((x) => [x, following(x, s.seeds.brand)])) }
      return { ...s, status: 'custom', seeds: { ...seeds, [tone]: hex } }
    }
    return { ...s, seeds: { ...s.seeds, [tone]: hex } }
  })
  /** Custom status colors that differ from the ones following the brand. */
  const statusOverridden = state.status === 'custom' && STATUS.some((tone) => state.seeds[tone] !== following(tone, state.seeds.brand))
  /** Drops the status overrides: back to following the brand. */
  const resetStatus = () => {
    update((s) => ({ ...s, status: 'brand', seeds: { ...s.seeds, ...Object.fromEntries(STATUS.map((tone) => [tone, own[tone]])) } }))
    setStatusRev((r) => r + 1)
  }

  /**
   * The site's shared color picker, as the Seed lab uses it: a field that opens
   * the pad and HEX/RGB/HSL/OKLCH entry. It reads `value` only at mount, so
   * `pickerRev` remounts it after outside changes such as Reset.
   */
  const picker = (tone: keyof ThemeState['seeds'], label: string) => (
    <Field key={tone} label={label} inline>
      <ColorPicker key={pickerKey(tone)} size="medium" layout="bare" label={label} value={pickerValue(tone)} onChange={(hex: string) => setSeed(tone, hex.slice(0, 7))} />
    </Field>
  )

  return (
    <div className={styles.panelBody}>
      <Section title="Theme">
        <div className={styles.fullRow}>
          <Tabs fill label="Start from" value={state.base}
            options={BASES.map((b) => ({ value: b.id, label: b.label }))}
            onStateChange={(_e: unknown, d: { next: string | null }) => d.next && d.next !== state.base && onBase(d.next as Base)} />
        </div>
        {shipped && <p className={styles.hint}>{baseLabel} sets its colors by hand. Color changes turn and scale its hues and keep its lightness steps.</p>}
      </Section>

      <Section title="Color">
        {picker('brand', 'Brand')}
        {/* Reading a website needs the dev server's headless browser; the deployed docs are static. */}
        {import.meta.env.DEV && (
          <>
            <Button priority="quaternary" paddingless className={styles.textAction} onClick={() => setWebsiteOpen(true)}>From website…</Button>
            <FromWebsite open={websiteOpen} onOpenChange={setWebsiteOpen} onApply={onWebsite} />
          </>
        )}
        <Seg label="Neutral" options={['Grey', 'Tinted', 'Custom']}
          value={['grey', 'tinted', 'custom'].indexOf(state.neutral)}
          onChange={(i) => update((s) => ({ ...s, neutral: (['grey', 'tinted', 'custom'] as const)[i] }))} />
        {state.neutral === 'custom' && picker('neutral', 'Neutral')}
        <Seg label="Intensity" options={['Muted', 'Balanced', 'Vivid']} value={shipped ? levelOf(state, ALL, 'color') : intensityLevel(t, state)}
          onChange={(i) => update((s) => setIntensity(t, s, i as Level))} />
        <Field label="Status" inline>
          <div className={styles.statusRow}>
            {/* Hidden while editing: the pickers below show the same colors. */}
            {/* The colors in use: following the brand, with Intensity applied. */}
            {!statusOpen && <span className={styles.swatches}>{STATUS.map((tone) => <span key={tone} className={styles.swatch} title={tone} style={{ background: inUse[tone] }} />)}</span>}
            <Button priority="quaternary" className={styles.statusAction} onClick={() => setStatusOpen(!statusOpen)}>{statusOpen ? 'Done' : 'Edit'}</Button>
          </div>
        </Field>
        {statusOpen && STATUS.map((tone) => picker(tone, tone[0].toUpperCase() + tone.slice(1)))}
        {statusOpen && statusOverridden && (
          <Button priority="quaternary" paddingless className={styles.textAction} onClick={resetStatus}>Reset</Button>
        )}
      </Section>

      <Section title="Type">
        <Field label="Font" inline>
          <Select aria-label="Font" value={state.type.font}
            options={FONTS.map((f) => ({ value: f.id, label: f.label }))}
            onValueChange={(v: FontId | null) => v && update((s) => ({ ...s, type: { ...s.type, font: v } }))} />
        </Field>
        <Seg label="Titles" options={['Sans', 'Serif']} value={state.type.titles === 'serif' ? 1 : 0}
          onChange={(i) => update((s) => ({ ...s, type: { ...s.type, titles: i ? 'serif' : 'sans' } }))} />
        <Seg label="Text size" options={['Small', 'Regular', 'Large']} value={state.type.size}
          onChange={(i) => update((s) => ({ ...s, type: { ...s.type, size: i as Level } }))} />
      </Section>

      <Section title="Shape">
        <Seg label="Corners" options={['Square', 'Soft', 'Round']} value={state.corners}
          onChange={(i) => update((s) => ({ ...s, corners: i as Level }))} />
      </Section>

    </div>
  )
}
