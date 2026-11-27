/**
 * Levels 2 and 3: All components first, then each family. Every entry has
 * its choices and an editable CSS block for the mode being previewed. The CSS
 * is the source of truth; choices show as selected only while it matches them.
 */
import { useState } from 'preact/hooks'
import { Banner, Button, Expander, Slider } from '@antadesign/anta'
import { ALL, CHOICES, editKey, type Level, type Mode, type ThemeState } from './model.ts'
import { familyDecls, globalLimits, lineChanged, renderTheme } from './generate.ts'
import { choicesFor, resetFamily, selectedLevel, setChoice, setEdit } from './match.ts'
import type { LimitVar } from './templates.ts'
import { Seg, type Update } from './controls.tsx'
import CodeEditor from './CodeEditor.tsx'
import { readCss } from './css-lines.ts'
import { templates, templatesFor } from './sources.ts'
import type { Templates } from './templates.ts'

/**
 * The templates of the base being tuned: Anta's, or a seed-model theme's with
 * its own limits as the baseline. Set by RailFineTune before its children render.
 */
let t: Templates = templates
import styles from './ThemeConfigurator.module.css'

export const FAMILY_LABELS: Record<string, string> = {
  [ALL]: 'All components',
  surface: 'Surfaces and borders',
  text: 'Text',
  button: 'Buttons',
  tag: 'Tags',
  checkbox: 'Checkbox',
  radio: 'Radio',
  switch: 'Switch',
}

const round = (n: number) => String(+n.toFixed(3))

/** The family's lines for one mode, as editable CSS. Comment lines name the rule they belong to. */
function cssText(state: ThemeState, family: string, mode: Mode): string {
  const decls = familyDecls(t, state, family)
  const scopes = [...new Set(decls.map((d) => d.scope))]
  return scopes
    .map((scope) => {
      const lines = decls.filter((d) => d.scope === scope).map((d) => `${d.prop}: ${d[mode]};`)
      return scopes.length > 1 ? [`/* ${scope} */`, ...lines].join('\n') : lines.join('\n')
    })
    .join('\n\n')
}

/** Color limits and CSS edit one mode at a time: the one the preview shows. */
const modeNote = (mode: Mode) => `${mode === 'dark' ? 'Dark' : 'Light'} mode. Switch the preview to edit the other.`

/** The browser's own color check, for marking invalid colors. */
const isColor = (value: string) => typeof CSS === 'undefined' || CSS.supports('color', value)

/**
 * Editable CSS for one entry and mode. Lines the configurator cannot use are
 * marked in the editor and ignored; see `css-lines.ts`.
 */
function CssBlock({ state, update, family, mode }: { state: ThemeState; update: Update; family: string; mode: Mode }) {
  const [issues, setIssues] = useState(0)
  const canonical = cssText(state, family, mode)
  const decls = familyDecls(t, state, family)
  const known = new Set(decls.map((d) => d.prop))
  // Marks the lines that reach the theme file, by the export's own rule.
  const isChanged = (prop: string) => lineChanged(t, state, family, prop, mode)

  const apply = (text: string) => {
    const reading = readCss(text, known, isColor)
    setIssues(reading.problems.filter((p) => p.severity === 'error').length)
    const byProp = new Map(familyDecls(t, state, family).map((d) => [d.prop, d]))
    const next = reading.lines.reduce((acc, line) => {
      const d = byProp.get(line.prop)!
      return line.value === d[mode] ? acc : setEdit(t, acc, family, mode, d.scope, d.prop, line.value)
    }, state)
    if (next !== state) update(() => next)
  }

  return (
    <div className={styles.cssEditor}>
      <CodeEditor
        key={`${family}:${mode}`}
        label={`${FAMILY_LABELS[family]} CSS, ${mode} mode`}
        value={canonical}
        onChange={apply}
        check={(text) => readCss(text, known, isColor).problems}
        isChanged={isChanged}
      />
      <p className={issues ? `${styles.hint} ${styles.edited}` : styles.hint}>
        {issues
          ? `${issues} line${issues === 1 ? '' : 's'} ignored. Hover a marked line for the reason.`
          : modeNote(mode)}
      </p>
    </div>
  )
}

const LIMIT_GROUPS: { title: string; rows: { label: string; vars: [LimitVar] | [LimitVar, LimitVar]; min: number; max: number }[] }[] = [
  { title: 'Solid fills', rows: [
    { label: 'Lightness', vars: ['--anta-solid-l-min', '--anta-solid-l-max'], min: 0, max: 1 },
    { label: 'Hover shift', vars: ['--anta-solid-l-hover'], min: -0.3, max: 0.3 },
    { label: 'Pressed shift', vars: ['--anta-solid-l-active'], min: -0.3, max: 0.3 },
    { label: 'Chroma cap', vars: ['--anta-solid-c-max'], min: 0, max: 0.4 },
  ] },
  { title: 'Labels on fills', rows: [{ label: 'Dark above', vars: ['--anta-on-solid-flip'], min: 0, max: 1 }] },
  { title: 'Toned text', rows: [
    { label: 'Lightness', vars: ['--anta-fg-l-min', '--anta-fg-l-max'], min: 0, max: 1 },
    { label: 'Hover shift', vars: ['--anta-fg-l-hover'], min: -0.3, max: 0.3 },
    { label: 'Chroma cap', vars: ['--anta-fg-c-max'], min: 0, max: 0.4 },
  ] },
]

/** Named controls for All components' limits, in the previewed mode. */
function LimitControls({ state, update, mode }: { state: ThemeState; update: Update; mode: Mode }) {
  const limits = globalLimits(t, state)[mode]
  const defaults = t.limits[mode]
  const flip = limits['--anta-on-solid-flip']
  const set = (pairs: [LimitVar, number][]) =>
    update((s) => pairs.reduce((acc, [name, v]) => setEdit(t, acc, ALL, mode, 'root', name, round(v)), s))

  return (
    <>
      {LIMIT_GROUPS.map((group) => (
        <div key={group.title} className={styles.fullRow}>
          <h4 className={styles.groupHeader}>{group.title}</h4>
          {group.rows.map((row) => {
            const value = row.vars.length === 2 ? ([limits[row.vars[0]], limits[row.vars[1]]] as [number, number]) : limits[row.vars[0]]
            // Amber marks a hand edit; a value moved by a choice stays plain.
            const edited = row.vars.some((v) => state.edits[ALL]?.[mode]?.[editKey('root', v)] !== undefined)
            return (
              <Slider
                key={row.label}
                label={<span className={edited ? styles.edited : undefined}>{row.label}</span>}
               
                min={row.min}
                max={row.max}
                step={0.01}
                value={value}
                valueDisplay="end"
                onValueChange={(_e: unknown, attrs: { value: number | [number, number] }) => {
                  const v = attrs.value
                  set(Array.isArray(v) ? [[row.vars[0], v[0]], [row.vars[1] as LimitVar, v[1]]] : [[row.vars[0], v]])
                }}
              />
            )
          })}
          {group.title === 'Labels on fills' && flip > defaults['--anta-on-solid-flip'] && (
            <Banner tone="warning" message={`White labels stay on fills up to lightness ${round(flip)}. WCAG 2 rates white text below 4.5:1 on fills lighter than about 0.58; Anta uses ${defaults['--anta-on-solid-flip']}.`} />
          )}
        </div>
      ))}
    </>
  )
}

/** An entry without its own choices and edits. */
const resetEntry = (s: ThemeState, family: string): ThemeState =>
  family === ALL ? { ...s, choices: { ...s.choices, [ALL]: {} }, edits: { ...s.edits, [ALL]: {} } } : resetFamily(s, family)

/**
 * Whether resetting an entry would change the theme. A choice or edit set
 * back to its original value is not a change, so Reset and "Edited" stay hidden.
 */
const hasOwnChanges = (s: ThemeState, family: string) => renderTheme(t, s) !== renderTheme(t, resetEntry(s, family))

function FamilyPanel({ state, update, family, mode }: { state: ThemeState; update: Update; family: string; mode: Mode }) {
  const [cssOpen, setCssOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const offered = choicesFor(t, family)
  const edited = hasOwnChanges(state, family)

  return (
    <div className={styles.form}>
      {offered.map((c) => (
        <Seg key={c} label={CHOICES[c].label} options={CHOICES[c].options} value={selectedLevel(t, state, family, c)}
          onChange={(i) => update((s) => setChoice(t, s, family, c, i as Level))} />
      ))}
      {offered.length > 0 && (
        <p className={styles.hint}>
          {family === ALL ? 'The choices are presets for the color limits below.' : 'These choices set the limits below, for this entry only.'}
        </p>
      )}
      {family === ALL && (
        <div className={styles.fullRow}>
          <Expander title="Color limits" priority="tertiary" open={limitsOpen} onStateChange={(_e: unknown, d: { next: boolean }) => setLimitsOpen(d.next)}>
            <div className={styles.nestedForm}>
              <LimitControls state={state} update={update} mode={mode} />
              <p className={styles.hint}>{modeNote(mode)}</p>
            </div>
          </Expander>
        </div>
      )}
      <div className={styles.fullRow}>
        {/* Every entry folds its CSS, so entries stay short until a line needs editing. */}
        <Expander title="CSS" priority="tertiary" open={cssOpen} onStateChange={(_e: unknown, d: { next: boolean }) => setCssOpen(d.next)}>
          <CssBlock key={`${family}:${mode}`} state={state} update={update} family={family} mode={mode} />
        </Expander>
      </div>
      {edited && (
        <div className={styles.fullRow}>
          <Button priority="quaternary" paddingless className={styles.textAction}
            onClick={() => update((s) => resetEntry(s, family))}>
            Reset styles
          </Button>
        </div>
      )}
    </div>
  )
}

export default function RailFineTune({ state, update, mode, open, onOpen, onBack }: {
  state: ThemeState
  update: Update
  mode: Mode
  open: string | null
  onOpen: (family: string | null) => void
  onBack: () => void
}) {
  t = templatesFor(state.base)
  const families = [ALL, ...t.families.map((f) => f.id)]
  /** Edited: resetting the entry would change the theme. Default otherwise, even while inheriting All components' changes. */
  const summary = (id: string) => (hasOwnChanges(state, id) ? 'Edited' : 'Default')
  return (
    <div className={styles.panelBody}>
      <div className={styles.backRow}>
        <Button priority="quaternary" icon="arrow-left" onClick={onBack}>Back to theme</Button>
      </div>
      <p className={`${styles.hint} ${styles.intro}`}>Each entry starts from All components. Changes apply to that entry only.</p>
      {families.map((id) => (
        <section key={id} className={styles.section} aria-label={FAMILY_LABELS[id] ?? id}>
          <Expander
            title={FAMILY_LABELS[id] ?? id}
            priority="tertiary"
            actions={<span className={styles.summary}>{summary(id)}</span>}
            open={open === id}
            onStateChange={(_e: unknown, d: { next: boolean }) => onOpen(d.next ? id : open === id ? null : open)}
          >
            {open === id && <FamilyPanel state={state} update={update} family={id} mode={mode} />}
          </Expander>
        </section>
      ))}
    </div>
  )
}
