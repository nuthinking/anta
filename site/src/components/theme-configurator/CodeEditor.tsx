/**
 * A CSS editor for the configurator's entries: CodeMirror 6 with CSS
 * highlighting, line wrapping and inline problems from `css-lines.ts`. It grows
 * with its content up to about 20 lines, then scrolls. Colors come from the
 * site's tokens, so it follows the site theme and light or dark mode.
 */
import { useEffect, useRef } from 'preact/hooks'
import { EditorState, RangeSetBuilder, StateEffect } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, keymap, lineNumbers, placeholder as placeholderExt, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, LanguageSupport, bracketMatching, syntaxHighlighting } from '@codemirror/language'
import { css, cssLanguage } from '@codemirror/lang-css'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import type { Problem } from './css-lines.ts'

/** CSS parsed as a declaration list (the grammar's `Styles` rule), since entries have no selectors. */
const declarations = new LanguageSupport(cssLanguage.configure({ top: 'Styles' }))

const highlight = HighlightStyle.define([
  { tag: [tags.propertyName, tags.variableName, tags.definition(tags.variableName)], color: 'var(--text-2-brand)' },
  { tag: [tags.number, tags.unit, tags.color, tags.atom, tags.keyword], color: 'var(--text-2-info)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.name)], color: 'var(--text-2-success)' },
  { tag: tags.comment, color: 'var(--text-4)', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--text-3)' },
])

/** Asks the change marks to recompute after the set of changed properties changes. */
const refreshMarks = StateEffect.define<null>()
const unchangedLine = Decoration.line({ class: 'cm-unchanged' })
const changedLine = Decoration.line({ class: 'cm-changed' })

/** Dims declarations that still match Anta and marks the changed ones. */
function changeMarks(isChanged: () => ((prop: string) => boolean) | undefined) {
  const build = (view: EditorView): DecorationSet => {
    const test = isChanged()
    const builder = new RangeSetBuilder<Decoration>()
    if (!test) return builder.finish()
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const prop = /^\s*(--[\w-]+)\s*:/.exec(line.text)?.[1]
        if (prop) builder.add(line.from, line.from, test(prop) ? changedLine : unchangedLine)
        pos = line.to + 1
      }
    }
    return builder.finish()
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.transactions.some((t) => t.effects.some((e) => e.is(refreshMarks)))) this.decorations = build(u.view)
    }
  }, { decorations: (p) => p.decorations })
}

const theme = EditorView.theme({
  '&': {
    fontFamily: 'var(--monospace)',
    fontSize: 'var(--font-size-code-block-medium)',
    color: 'var(--text-1)',
    background: 'var(--bg-1)',
    border: '1px solid var(--border-3)',
    borderRadius: '6px',
  },
  '&.cm-focused': { outline: '2px solid var(--focus-ring)', outlineOffset: '1px' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'var(--line-height-code-block-medium)', maxHeight: 'var(--code-editor-max-height, 28em)', overflow: 'auto' },
  '.cm-lineNumbers .cm-gutterElement': { color: 'var(--text-5)', padding: '0 6px 0 10px' },
  // Lines that still match Anta are dimmed; changed lines carry the edited color's bar.
  '.cm-line.cm-unchanged': { opacity: '0.55' },
  '.cm-line.cm-changed': { boxShadow: 'inset 2px 0 0 var(--text-2-warning)' },
  '.cm-content': { padding: '6px 0', caretColor: 'var(--text-1)' },
  '.cm-line': { padding: '0 8px' },
  '.cm-gutters': { background: 'transparent', border: 'none' },
  '.cm-lint-marker': { width: '0.8em', height: '0.8em' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': { background: 'color-mix(in oklch, var(--text-2-brand) 25%, transparent) !important' },
  '.cm-matchingBracket': { background: 'color-mix(in oklch, var(--text-2-brand) 20%, transparent)', outline: 'none' },
  '.cm-tooltip': { background: 'var(--bg-pane)', border: '1px solid var(--border-4)', borderRadius: '6px', color: 'var(--text-1)' },
  '.cm-diagnostic': { fontFamily: 'var(--sans-serif)', fontSize: '12px', padding: '4px 8px' },
})

export default function CodeEditor({ value, onChange, check, label, readOnly = false, maxHeight, isChanged }: {
  value: string
  /** Called with the whole text on every edit. */
  onChange?: (text: string) => void
  /** Problems to mark, for the current text. */
  check?: (text: string) => Problem[]
  /** Accessible name of the editing area. */
  label: string
  /** A viewer: selectable and copyable, with line numbers, but not editable. */
  readOnly?: boolean
  /** Height before the editor scrolls. Defaults to about 20 lines. */
  maxHeight?: string
  /** Whether a property differs from Anta's default; when given, lines are marked. */
  isChanged?: (prop: string) => boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // The latest callbacks, read by the editor's long-lived extensions.
  const latest = useRef({ onChange, check, isChanged })
  latest.current = { onChange, check, isChanged }

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      // Mount the editor's styles on the page itself: inside an expander, the
      // host can be created before it is attached, and CodeMirror would then
      // put its styles in the detached tree.
      root: document,
      state: EditorState.create({
        doc: value,
        extensions: [
          // A theme file has selectors and rules; an entry's lines are a bare declaration list.
          readOnly ? css() : declarations,
          syntaxHighlighting(highlight),
          bracketMatching(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
          theme,
          changeMarks(() => latest.current.isChanged),
          ...(readOnly
            ? [EditorState.readOnly.of(true), lineNumbers(), keymap.of(defaultKeymap)]
            : [
              history(),
              keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
              lintGutter(),
              linter((v): Diagnostic[] => latest.current.check?.(v.state.doc.toString()) ?? [], { delay: 250 }),
              placeholderExt('--name: value;'),
              EditorView.updateListener.of((u) => { if (u.docChanged) latest.current.onChange?.(u.state.doc.toString()) }),
            ]),
        ],
      }),
    })
    return () => view.current?.destroy()
  }, [])

  // Outside changes (a choice, Reset, the other mode) replace the text, but never while typing.
  useEffect(() => {
    const v = view.current
    if (!v || (v.hasFocus && !readOnly) || v.state.doc.toString() === value) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  // Choices and edits elsewhere change which lines differ; redraw the marks.
  const changedKey = isChanged ? [...value.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => (isChanged(m[1]) ? 1 : 0)).join('') : ''
  useEffect(() => { view.current?.dispatch({ effects: refreshMarks.of(null) }) }, [changedKey])

  return <div ref={host} style={maxHeight ? { '--code-editor-max-height': maxHeight } as any : undefined} />
}
