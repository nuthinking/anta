/** The exported theme file: read-only, with Copy and Download. */
import { Banner, Button, ButtonCopy, Dialog, Text } from '@antadesign/anta'
import type { Base } from './model.ts'
import CodeEditor from './CodeEditor.tsx'
import styles from './ThemeConfigurator.module.css'

export const LICENSE_URL = 'https://github.com/antithesishq/anta/blob/main/theme-antithesis-license.md'

export function LicenseNotice() {
  return (
    <Banner tone="warning" message={
      <span>
        Antithesis theme license: free for noncommercial use. Commercial use needs written permission. This also covers themes built on it.{' '}
        <a href={LICENSE_URL}>Read the license</a>
      </span>
    } />
  )
}

function download(css: string) {
  const url = URL.createObjectURL(new Blob([css], { type: 'text/css' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'my-theme.css'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ViewCssDialog({ open, onOpenChange, css, base, custom }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  css: string
  base: Base
  custom: boolean
}) {
  const shipped = base !== 'default'
  const lines = css ? css.trimEnd().split('\n').length : 0
  const name = base === 'antune' ? 'Antune' : base === 'antera' ? 'Antera' : 'Antithesis'
  // A shipped base exports its whole theme file, which replaces the shipped one.
  const summary = shipped
    ? custom ? `Custom theme based on ${name} · ${lines} lines · use it instead of ${name}` : `The ${name} theme · ${lines} lines`
    : custom ? `${lines} lines: only what differs from Anta's defaults, in light and dark mode.` : 'No changes yet: the theme matches Anta\'s defaults.'
  const file = css || '/* No changes yet: the theme matches Anta\'s defaults. */\n'

  return (
    <Dialog
      className={styles.cssDialog}
      open={open}
      onStateChange={(_e: unknown, d: { next: boolean }) => onOpenChange(d.next)}
      header="my-theme.css"
      footer={
        <div className={styles.dialogFooter}>
          <Text size="small" priority="tertiary">Load it after Anta's styles.</Text>
          <Button priority="secondary" icon="download" onClick={() => download(file)}>Download</Button>
          <ButtonCopy copy={file} label="Copy" tone="brand" priority="primary" />
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <Text size="small" priority="tertiary">{summary}</Text>
        <CodeEditor readOnly value={file} label="Theme CSS" maxHeight="50vh" />
        {base === 'antithesis' && <LicenseNotice />}
      </div>
    </Dialog>
  )
}
