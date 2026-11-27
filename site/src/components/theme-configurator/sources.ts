/** The shipped CSS the configurator reads, bundled as text by Vite. */
import tokens from '../../../../src/tokens.css?raw'
import button from '../../../../src/elements/a-button.css?raw'
import tag from '../../../../src/elements/a-tag.css?raw'
import checkbox from '../../../../src/elements/a-checkbox.css?raw'
import radio from '../../../../src/elements/a-radio.css?raw'
import switchCss from '../../../../src/elements/a-switch.css?raw'
import antune from '../../../../src/theme-antune.css?raw'
import antithesis from '../../../../src/theme-antithesis.css?raw'
// Antune rebuilt on the seed model: a configurator-only experiment, not a published theme.
import antera from './themes/antera.css?raw'
import { readTemplates } from './templates.ts'
import { shippedSeeds } from './rederive.ts'
import { templatesWithLimits } from './generate.ts'
import type { Base } from './model.ts'
import { SEED } from '../theming-lab-formulas.ts'
import type { SeedsFor } from './model.ts'

export const templates = readTemplates({ tokens, button, tag, checkbox, radio, switch: switchCss })

/** Shipped theme files, re-derived when a shipped base is edited. */
export const SHIPPED_THEMES = { antune, antera, antithesis } as const

const SHIPPED_SEEDS = { antune: shippedSeeds(antune), antera: shippedSeeds(antera), antithesis: shippedSeeds(antithesis) }

/** Each base's own seeds: Anta's for Default, plus any a shipped theme declares. */
export const seedsFor: SeedsFor = (base) => (base === 'default' ? SEED : SHIPPED_SEEDS[base])

/** Bases built on the seed model, which fine-tuning can work on. */
export const TUNABLE: readonly Base[] = ['default', 'antera']
const anteraTemplates = templatesWithLimits(templates, antera)
/** Templates for a base: Anta's, with the base's own limits as the baseline. */
export const templatesFor = (base: Base) => (base === 'antera' ? anteraTemplates : templates)
