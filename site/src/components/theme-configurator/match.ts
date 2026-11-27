/**
 * Selection state for dials and choices. The CSS is the source of truth: a
 * choice shows as selected only while the current lines still match what it
 * would write. Matching compares the numbers inside each value, so editing a
 * line's lightness deselects Fill strength but leaves Colorfulness selected.
 */
import { ALL, CHOICE_IDS, LEVELS, MODES, defaultState, editKey, levelOf, type ChoiceId, type Level, type Mode, type ThemeState } from './model.ts'
import { familyDecls, isSafeValue, type Decl } from './generate.ts'
import type { Templates } from './templates.ts'

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi

/** A value split into its text skeleton and the numbers in it. */
function slots(value: string) {
  const v = value.replace(/\s+/g, ' ').trim()
  return { skeleton: v.replace(NUMBER, '#'), nums: (v.match(NUMBER) ?? []).map(Number) }
}

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-6
const index = (decls: Decl[]) => new Map(decls.map((d) => [editKey(d.scope, d.prop), d]))

const withLevel = (state: ThemeState, family: string, choice: ChoiceId, level: Level): ThemeState => ({
  ...state,
  choices: { ...state.choices, [family]: { ...state.choices[family], [choice]: level } },
  edits: {},
})

/**
 * Number slots a choice controls, as `scope|prop` → mode → slot indexes. A
 * slot is owned when its value differs between the choice's options.
 */
export function ownedSlots(t: Templates, state: ThemeState, family: string, choice: ChoiceId): Map<string, Map<Mode, number[]>> {
  const variants = LEVELS.map((l) => index(familyDecls(t, withLevel(state, family, choice, l), family)))
  const owned = new Map<string, Map<Mode, number[]>>()
  for (const [key, d0] of variants[0]) {
    for (const mode of MODES) {
      const all = variants.map((v) => slots(v.get(key)?.[mode] ?? d0[mode]))
      if (all.some((s) => s.skeleton !== all[0].skeleton)) {
        // The option changes the line's shape (a pinned chroma becoming a scaled one): own it whole.
        if (!owned.has(key)) owned.set(key, new Map())
        owned.get(key)!.set(mode, [-1])
        continue
      }
      const idx = all[0].nums.map((_, i) => i).filter((i) => all.some((s) => !sameNumber(s.nums[i], all[0].nums[i])))
      if (!idx.length) continue
      if (!owned.has(key)) owned.set(key, new Map())
      owned.get(key)!.set(mode, idx)
    }
  }
  return owned
}

/**
 * Choices a family offers: those whose options change at least one of its
 * lines. All components offers every choice any component offers.
 */
export function choicesFor(t: Templates, family: string): ChoiceId[] {
  if (family === ALL) return CHOICE_IDS.filter((c) => t.families.some((f) => choicesFor(t, f.id).includes(c)))
  // Surfaces and Text are page-level tokens: their own limits could only be
  // written into each line as numbers, so they are edited as CSS instead.
  if (t.families.find((f) => f.id === family)?.kind === 'role') return []
  return CHOICE_IDS.filter((c) => ownedSlots(t, defaultState(), family, c).size > 0)
}

/** The option whose lines match the current CSS, or null when hand edits changed them. */
export function selectedLevel(t: Templates, state: ThemeState, family: string, choice: ChoiceId): Level | null {
  const owned = ownedSlots(t, state, family, choice)
  const current = index(familyDecls(t, state, family))
  const order = [levelOf(state, family, choice), ...LEVELS.filter((l) => l !== levelOf(state, family, choice))]
  for (const level of order) {
    const candidate = index(familyDecls(t, withLevel(state, family, choice, level), family))
    let match = true
    for (const [key, modes] of owned) {
      for (const [mode, idx] of modes) {
        const a = slots(current.get(key)![mode])
        const b = slots(candidate.get(key)![mode])
        if (a.skeleton !== b.skeleton) match = false
        else if (idx[0] !== -1 && idx.some((i) => !sameNumber(a.nums[i], b.nums[i]))) match = false
        else if (idx[0] === -1 && a.nums.some((n, i) => !sameNumber(n, b.nums[i]))) match = false
      }
      if (!match) break
    }
    if (match) return level
  }
  return null
}

/** Pick an option. It rewrites the lines it owns, dropping hand edits to them. */
export function setChoice(t: Templates, state: ThemeState, family: string, choice: ChoiceId, level: Level): ThemeState {
  const owned = ownedSlots(t, state, family, choice)
  const edits = structuredClone(state.edits[family] ?? {})
  for (const [key, modes] of owned) for (const mode of modes.keys()) delete edits[mode]?.[key]
  const own = { ...state.choices[family], [choice]: level }
  // A family set back to All components' level follows All again; All set back to Standard is Anta's default.
  if (family !== ALL ? level === levelOf(state, ALL, choice) : level === 1) delete own[choice]
  return {
    ...state,
    choices: { ...state.choices, [family]: own },
    edits: { ...state.edits, [family]: edits },
  }
}

/**
 * Hand-edit one line in one mode. Only existing properties can be edited,
 * All components accepts numbers only, and unsafe values are refused: the
 * state comes back unchanged.
 */
export function setEdit(t: Templates, state: ThemeState, family: string, mode: Mode, scope: string, prop: string, value: string): ThemeState {
  const key = editKey(scope, prop)
  if (!isSafeValue(value)) return state
  if (family === ALL && !Number.isFinite(Number(value))) return state
  if (!familyDecls(t, state, family).some((d) => editKey(d.scope, d.prop) === key)) return state
  const edits = structuredClone(state.edits[family] ?? {})
  ;(edits[mode] ??= {})[key] = value.trim()
  return { ...state, edits: { ...state.edits, [family]: edits } }
}

/** Drop a family's own choices and edits so it follows All components again. */
export function resetFamily(state: ThemeState, family: string): ThemeState {
  const choices = { ...state.choices }
  const edits = { ...state.edits }
  delete choices[family]
  delete edits[family]
  return { ...state, choices, edits }
}

/** Level 1 Intensity: Colorfulness everywhere, or null when families differ. */
export function intensityLevel(t: Templates, state: ThemeState): Level | null {
  const families = [ALL, ...t.families.map((f) => f.id)].filter((f) => f === ALL || choicesFor(t, f).includes('color'))
  const levels = families.map((f) => selectedLevel(t, state, f, 'color'))
  return levels.every((l) => l === levels[0]) ? levels[0] : null
}

/** Set Colorfulness on All components and clear every family's own Colorfulness. */
export function setIntensity(t: Templates, state: ThemeState, level: Level): ThemeState {
  let s = setChoice(t, state, ALL, 'color', level)
  for (const f of t.families) {
    if (s.choices[f.id]?.color !== undefined) {
      const own = { ...s.choices[f.id] }
      delete own.color
      s = { ...s, choices: { ...s.choices, [f.id]: own } }
    }
    const owned = ownedSlots(t, s, f.id, 'color')
    const edits = structuredClone(s.edits[f.id] ?? {})
    for (const [key, modes] of owned) for (const mode of modes.keys()) delete edits[mode]?.[key]
    s = { ...s, edits: { ...s.edits, [f.id]: edits } }
  }
  return s
}
