/** The shipped CSS the configurator reads, bundled as text by Vite. */
import tokens from '../../../../src/tokens.css?raw'
import button from '../../../../src/elements/a-button.css?raw'
import tag from '../../../../src/elements/a-tag.css?raw'
import checkbox from '../../../../src/elements/a-checkbox.css?raw'
import radio from '../../../../src/elements/a-radio.css?raw'
import switchCss from '../../../../src/elements/a-switch.css?raw'
import antune from '../../../../src/theme-antune.css?raw'
import antithesis from '../../../../src/theme-antithesis.css?raw'
import { readTemplates } from './templates.ts'
import { shippedSeeds } from './rederive.ts'
import { SEED } from '../theming-lab-formulas.ts'
import type { SeedsFor } from './model.ts'

export const templates = readTemplates({ tokens, button, tag, checkbox, radio, switch: switchCss })

/** Shipped theme files, re-derived when a shipped base is edited. */
export const SHIPPED_THEMES = { antune, antithesis } as const

const SHIPPED_SEEDS = { antune: shippedSeeds(antune), antithesis: shippedSeeds(antithesis) }

/** Each base's own seeds: Anta's for Default, plus any a shipped theme declares. */
export const seedsFor: SeedsFor = (base) => (base === 'default' ? SEED : SHIPPED_SEEDS[base])
