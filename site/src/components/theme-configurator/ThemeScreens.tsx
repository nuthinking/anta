/**
 * The theme configurator's preview, rendered inside `/theme-preview/`. Four
 * app screens show the theme in context; a state strip shows the open
 * family's component in every state. The parent page drives it with
 * `anta-theme-preview` messages.
 */
import { useEffect, useState } from 'preact/hooks'
import {
  Avatar, Banner, Button, Card, Checkbox, Icon, Input, Progress, RadioGroup, Select, Steps, Switch, Tabs, Tag, Text, Title,
} from '@antadesign/anta'
import { DESIGN_WIDTH, layout } from './layout.ts'
import styles from './ThemeScreens.module.css'

type View = 'grid' | 'list'
// Antera has no published file: its CSS arrives with the message, over the empty default.
const THEMES: Record<string, string> = { none: '/themes/default.css', antune: '/themes/antune.css', antera: '/themes/default.css', antithesis: '/themes/antithesis.css' }
/** Themes that borrow another theme's site fonts. */
const FONTS_OF: Record<string, string> = { antera: 'antune' }
/** A screen's content area. `active` names the page it stands for. */
function Shell({ children }: { active?: string; children: any }) {
  return <main className={styles.main}>{children}</main>
}

function Dashboard() {
  const stats = [
    ['Passing runs', '1,284', 'success', '+12%'],
    ['Failures', '37', 'critical', '−4%'],
    ['Flaky tests', '9', 'warning', '+2'],
  ] as const
  return (
    <Shell active="Overview">
      <div className={styles.header}>
        <div><Title level={3}>Overview</Title><Text size="small" priority="tertiary">Last 30 days across all projects</Text></div>
        <Button tone="brand" priority="primary" icon="plus">New run</Button>
      </div>
      <div className={styles.stats}>
        {stats.map(([label, value, tone, delta]) => (
          <Card key={label} header={label}>
            <div className={styles.stat}><span className={styles.statValue}>{value}</span><Tag tone={tone}>{delta}</Tag></div>
          </Card>
        ))}
      </div>
      <Card header="Coverage by project" subtitle="Share of properties exercised" tone="brand" icon="search-check">
        <div className={styles.bars}>
          {[['Payments', 82], ['Search', 64], ['Accounts', 47], ['Notifications', 91]].map(([name, v]) => (
            <Progress key={name} value={v as number} tone="brand" label={name as string} />
          ))}
        </div>
      </Card>
      <Banner tone="info" message="Two projects have new runs since your last visit." />
    </Shell>
  )
}

function Settings() {
  return (
    <Shell active="Settings">
      <div className={styles.header}><Title level={3}>Project settings</Title></div>
      <Tabs label="Settings section" defaultValue="general" options={[{ value: 'general', label: 'General' }, { value: 'alerts', label: 'Alerts' }, { value: 'billing', label: 'Billing' }]} />
      <div className={styles.form}>
        <Input label="Project name" defaultValue="Payments service" hint="Shown on reports and invites." />
        <Select label="Region" defaultValue="eu" options={[{ value: 'eu', label: 'Europe' }, { value: 'us', label: 'United States' }, { value: 'ap', label: 'Asia Pacific' }]} />
        <Input label="Webhook URL" defaultValue="http://hooks.acme" status="critical" hint="Use an https:// address." />
        <Input label="Run budget" defaultValue="200 hours" hint="Per month" />
      </div>
      <div className={styles.row}>
        <Switch label="Email me when a run fails" defaultChecked tone="brand" />
        <Checkbox label="Include flaky tests" defaultChecked tone="brand" />
      </div>
      <RadioGroup name="theme-screens-frequency" defaultValue="daily" tone="brand" options={[{ value: 'hourly', label: 'Hourly' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />
      <div className={styles.row}>
        <Button tone="brand" priority="primary">Save changes</Button>
        <Button priority="secondary">Cancel</Button>
        <Button priority="tertiary" tone="critical">Delete project</Button>
      </div>
    </Shell>
  )
}

function Runs() {
  const runs = [
    ['Nightly fuzz', 'Alex Morgan', 'success', 'Passed', '14 min'],
    ['Checkout flow', 'Sam Lee', 'critical', 'Failed', '6 min'],
    ['Search indexer', 'Priya Shah', 'success', 'Passed', '22 min'],
    ['Ledger sync', 'Jo Kim', 'warning', 'Flaky', '9 min'],
    ['Auth service', 'Alex Morgan', 'info', 'Running', '3 min'],
    ['Notifications', 'Sam Lee', 'success', 'Passed', '11 min'],
  ] as const
  return (
    <Shell active="Runs">
      <div className={styles.header}>
        <Title level={3}>Runs</Title>
        <div className={styles.row}><Input placeholder="Search runs" leading={<Icon shape="search" />} size="small" /><Button tone="brand" priority="primary" size="small">Start run</Button></div>
      </div>
      <div className={styles.row}>
        <Tag tone="brand" priority="primary">All</Tag><Tag>Passed</Tag><Tag>Failed</Tag><Tag>Mine</Tag>
      </div>
      <div className={styles.table} role="table" aria-label="Recent runs">
        {runs.map(([name, who, tone, status, time], i) => (
          <div key={name} className={i === 1 ? styles.selectedRow : styles.tableRow} role="row">
            <Avatar name={who} seed={who} size={24} round />
            <Text className={styles.grow}>{name}</Text>
            <Text size="small" priority="tertiary">{who}</Text>
            <Text size="small" priority="tertiary">{time}</Text>
            <Tag tone={tone}>{status}</Tag>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function NewProject() {
  return (
    <div className={styles.dialogScreen}>
      <div className={styles.dimmed} aria-hidden="true"><Runs /></div>
      <div className={styles.dialog} role="dialog" aria-label="New project">
        <Steps label="New project steps" defaultValue="setup" tone="brand" options={[
          { value: 'source', label: 'Source', state: 'completed' },
          { value: 'setup', label: 'Setup', state: 'incomplete' },
          { value: 'invite', label: 'Invite', state: 'incomplete' },
        ]} />
        <Title level={4}>Set up your project</Title>
        <Input label="Repository" defaultValue="acme/payments" />
        <RadioGroup name="theme-screens-plan" defaultValue="team" tone="brand" options={[{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }]} />
        <div className={styles.dialogActions}><Button priority="tertiary">Back</Button><Button tone="brand" priority="primary">Continue</Button></div>
      </div>
      <div className={styles.toast}><Banner tone="success" message="Repository connected." /></div>
    </div>
  )
}

const SCREENS = [['Dashboard', Dashboard], ['Settings form', Settings], ['Runs list', Runs], ['New-project dialog', NewProject]] as const

const BUTTON_STATES: Record<string, [string, Record<string, string>][]> = {
  primary: [['Rest', {}], ['Hover', { '--button-bg': 'var(--button-bg-primary-hover)' }], ['Pressed', { '--button-bg': 'var(--button-bg-primary-active)' }]],
  secondary: [['Rest', {}], ['Hover', { '--button-fg': 'var(--button-fg-secondary-hover)', '--button-bg': 'var(--button-bg-secondary-hover)' }], ['Pressed', { '--button-fg': 'var(--button-fg-secondary-hover)', '--button-bg': 'var(--button-bg-secondary-active)' }]],
  tertiary: [['Rest', {}], ['Hover', { '--button-fg': 'var(--button-fg-tertiary-hover)', '--button-bg': 'var(--button-bg-tertiary-hover)' }], ['Pressed', { '--button-fg': 'var(--button-fg-tertiary-hover)', '--button-bg': 'var(--button-bg-tertiary-active)' }]],
}

function ButtonRows({ priorities }: { priorities: string[] }) {
  return (
    <>
      {priorities.map((p) => (
        <div key={p} className={styles.stripRow}>
          <span className={styles.stripLabel}>{p[0].toUpperCase() + p.slice(1)}</span>
          {BUTTON_STATES[p].map(([label, vars]) => <Button key={label} tone="brand" priority={p as any} style={vars as any}>{label}</Button>)}
          <Button tone="brand" priority={p as any} disabled>Disabled</Button>
        </div>
      ))}
    </>
  )
}

const TONES = ['brand', 'info', 'success', 'warning', 'critical'] as const

/** One family's components in every state the preview can show. */
function StateStrip({ family }: { family: string }) {
  const row = (label: string, children: any) => <div className={styles.stripRow}><span className={styles.stripLabel}>{label}</span>{children}</div>
  let body: any
  if (family === 'button') body = <ButtonRows priorities={['primary', 'secondary', 'tertiary']} />
  else if (family === 'all') body = (
    <>
      <ButtonRows priorities={['primary']} />
      {row('Tag', <><Tag tone="brand" priority="primary">Primary</Tag><Tag tone="brand" priority="secondary">Secondary</Tag><Tag tone="brand" priority="tertiary">Tertiary</Tag></>)}
      {row('Switch', <><Switch label="On" defaultChecked tone="brand" /><Switch label="Off" tone="brand" /><Switch label="Disabled" defaultChecked disabled tone="brand" /></>)}
      {row('Checkbox', <><Checkbox label="Checked" defaultChecked tone="brand" /><Checkbox label="Empty" tone="brand" /><Checkbox label="Disabled" defaultChecked disabled tone="brand" /></>)}
    </>
  )
  else if (family === 'tag') body = TONES.map((t) => row(t, <><Tag tone={t} priority="primary">Primary</Tag><Tag tone={t} priority="secondary">Secondary</Tag><Tag tone={t} priority="tertiary">Tertiary</Tag></>))
  else if (family === 'checkbox') body = TONES.map((t) => row(t, <><Checkbox label="Checked" defaultChecked tone={t} /><Checkbox label="Empty" tone={t} /><Checkbox label="Disabled" defaultChecked disabled tone={t} /></>))
  else if (family === 'radio') body = TONES.map((t) => row(t, <RadioGroup name={`strip-${t}`} defaultValue="a" tone={t} options={[{ value: 'a', label: 'Selected' }, { value: 'b', label: 'Option' }]} />))
  else if (family === 'switch') body = TONES.map((t) => row(t, <><Switch label="On" defaultChecked tone={t} /><Switch label="Off" tone={t} /><Switch label="Disabled" defaultChecked disabled tone={t} /></>))
  else if (family === 'surface') body = TONES.map((t) => row(t, <div className={styles.swatches}>
    {[2, 3, 4, 5].map((n) => <i key={`bg${n}`} title={`--bg-${n}-${t}`} style={{ background: `var(--bg-${n}-${t})` }} />)}
    <span />
    {[1, 2, 3, 4, 5].map((n) => <i key={`bd${n}`} title={`--border-${n}-${t}`} style={{ background: `var(--border-${n}-${t})` }} />)}
  </div>))
  else if (family === 'text') body = TONES.map((t) => row(t, <span className={styles.textRamp}>
    {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ color: `var(--text-${n}-${t})` }}>Text {n}</span>)}
  </span>))
  if (!body) return null
  return (
    <section className={styles.strip} aria-label="Components in every state">
      <Text size="small" priority="tertiary">{family === 'button' || family === 'all' ? 'Rest, hover, pressed and disabled' : 'Every tone'}</Text>
      {body}
    </section>
  )
}

export default function ThemeScreens() {
  const [view, setView] = useState<View>('grid')
  const [family, setFamily] = useState<string | null>(null)
  const [width, setWidth] = useState(DESIGN_WIDTH)

  useEffect(() => {
    const custom = document.createElement('style')
    custom.id = 'preview-custom'
    document.head.appendChild(custom)
    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'anta-theme-preview') return
      const { theme, dark, css, view: v, family: f } = event.data
      const href = THEMES[theme]
      if (href) {
        const link = document.querySelector<HTMLLinkElement>('#preview-theme')!
        if (link.getAttribute('href') !== href) link.href = href
        const fonts = document.querySelector<HTMLLinkElement>('#preview-fonts')!
        const fontsHref = theme === 'none' ? THEMES.none : `/themes/fonts-${FONTS_OF[theme] ?? theme}.css`
        if (fonts.getAttribute('href') !== fontsHref) fonts.href = fontsHref
      }
      document.documentElement.classList.toggle('dark', dark === true)
      if (typeof css === 'string' && custom.textContent !== css) custom.textContent = css
      if (v === 'grid' || v === 'list') setView(v)
      setFamily(typeof f === 'string' ? f : null)
    }
    // The parent sizes the iframe to one layout's exact width. innerWidth
    // includes any scrollbar, so a scrollbar cannot drop the layout a step.
    const onResize = () => setWidth(window.innerWidth)
    onResize()
    window.addEventListener('message', onMessage)
    window.addEventListener('resize', onResize)
    parent.postMessage({ type: 'anta-theme-preview-ready' }, location.origin)
    // Report the content height so the parent sizes the iframe and nothing scrolls inside it.
    // Measure the page element: the document's scrollHeight never drops below the
    // iframe's current height, so it could only ever grow.
    const page = document.querySelector<HTMLElement>('[data-preview-page]')!
    const sizer = new ResizeObserver(() => {
      parent.postMessage({ type: 'anta-theme-preview-size', height: Math.ceil(page.getBoundingClientRect().height) }, location.origin)
    })
    sizer.observe(page)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('resize', onResize)
      sizer.disconnect()
      custom.remove()
    }
  }, [])

  const { columns, zoom } = layout(view, width)

  return (
    <div className={styles.page} data-preview-page>
      {family && <StateStrip family={family} />}
      <div className={styles.screens} style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}>
        {SCREENS.map(([label, Screen]) => (
          <figure key={label} className={styles.figure}>
            <figcaption className={styles.caption}>{label}</figcaption>
            <div className={styles.screen} style={{ zoom, width: `${DESIGN_WIDTH}px` }}><Screen /></div>
          </figure>
        ))}
      </div>
    </div>
  )
}
