/**
 * The Corners dial. It sets the radius hooks components expose, as the
 * Antithesis theme does, and skips any component with an explicit `round`
 * attribute. Soft is Anta's default and writes nothing.
 *
 * Components without a hook or part for their radius (Tag, Checkbox, Radio,
 * Switch, Banner, Progress) keep their own corners.
 */
import type { Level } from './model.ts'

const BUTTONS = ':is(a-button, a[role="button"][data-anta], button[data-anta], input[data-anta]:is([type="reset"], [type="submit"])):not([round])'

interface Radii { button: string; field: string; card: string; dialog: string; menu: string; tab: string; expander: string }

const PRESETS: Record<0 | 2, Radii> = {
  0: { button: '2px', field: '2px', card: '2px', dialog: '2px', menu: '2px', tab: '2px', expander: '2px' },
  2: { button: '999px', field: '10px', card: '14px', dialog: '18px', menu: '12px', tab: 'calc(var(--tab-height) / 2)', expander: '10px' },
}

/** Layered rule blocks for a Corners level; empty for Soft. */
export function cornerRules(level: Level): string[] {
  if (level === 1) return []
  const r = PRESETS[level]
  const rules = [
    `${BUTTONS} {\n  --_radius: ${r.button};\n}`,
    `a-input:not([round])::part(field),\na-input:not([round]):not(:defined)::after {\n  border-radius: ${r.field};\n}`,
    `a-card:not([round]) {\n  --card-radius: ${r.card};\n}`,
    `a-dialog:not([round]) {\n  --dialog-radius: ${r.dialog};\n}`,
    `a-menu:not([round], a-menu[round] a-menu) {\n  --menu-radius: ${r.menu};\n}`,
    `a-tabs:not([round], [data-steps]) {\n  --tab-radius: ${r.tab};\n}`,
    `a-expander:not([round])::part(summary) {\n  border-radius: ${r.expander};\n}`,
  ]
  // A pill tab strip needs the track itself rounded, as in the Antithesis theme.
  if (level === 2) rules.push('a-tabs:not([round], [data-steps], [priority="secondary"], [priority="tertiary"]) {\n  border-radius: var(--tab-radius);\n}')
  return rules
}
