/**
 * Small controls shared by the configurator's panel. A row puts its label
 * above the control, or beside it (one third to two thirds) when the control
 * is compact enough: one field, or a choice between two options.
 */
import { Tabs } from '@antadesign/anta'
import type { ThemeState } from './model.ts'
import styles from './ThemeConfigurator.module.css'

export type Update = (fn: (s: ThemeState) => ThemeState) => void

/** One form row. `inline` puts the label beside the control instead of above it. */
export function Field({ label, children, edited, inline }: { label: string; children: any; edited?: boolean; inline?: boolean }) {
  return (
    <div className={inline ? `${styles.field} ${styles.fieldInline}` : styles.field}>
      <span className={edited ? `${styles.fieldLabel} ${styles.edited}` : styles.fieldLabel}>{label}</span>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  )
}

/**
 * A segmented choice. `value` is an option index, or null when the current
 * CSS matches no option. Two options fit beside the label; three need the
 * full row.
 */
export function Seg({ label, options, value, onChange, disabled }: {
  label: string
  options: readonly string[]
  value: number | null
  onChange: (index: number) => void
  disabled?: boolean
}) {
  return (
    <Field label={label} inline={options.length <= 2}>
      <Tabs
        fill
        label={label}
        disabled={disabled}
        value={value === null ? '' : String(value)}
        options={options.map((o, i) => ({ value: String(i), label: o }))}
        onStateChange={(_e: unknown, d: { next: string | null }) => {
          if (d.next !== null && d.next !== '') onChange(Number(d.next))
        }}
      />
    </Field>
  )
}
