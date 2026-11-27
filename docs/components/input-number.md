# InputNumber

Use InputNumber for a quantity someone adjusts as often as they type it, such as
an opacity, a size, or a count. Drag across the field to scrub the value, press
the step buttons, use the arrow keys, or type a number.

The value is a number, or `null` while the field is empty. Use `defaultValue`
for an initial number, or pair `value` with `onValueChange` to control it. Add
`name` to submit the value with a form.

## Change the value

InputNumber builds on the native number input, so typing, validation, and form
submission behave as they do there. It adds two ways to change the value without
typing.

- **Scrub.** Press on the field and drag left or right. The value changes by one
  `step` for every 2 pixels. Hold Shift for ten steps at a time, or
  Alt for a tenth of a step.
- **Step.** Press a step button, or press ↑ or ↓ in the
  focused field. Hold a button to repeat. Hold Shift while pressing a
  button for ten steps.

A click without a drag focuses the field and selects the number, ready for
typing. A focused field edits text, so dragging there selects digits. Press
Tab or click elsewhere to scrub again. Touch input does not scrub, so
a touch can still scroll the page.

```tsx
<InputNumber label="Quantity" defaultValue={12} />
<InputNumber label="Opacity" defaultValue={0.5} min={0} max={1} step={0.01} />
```

## Limits and step

`min` and `max` stop scrubbing and stepping at the bounds. `step` sets the
increment and the number of decimals a scrub produces: a step of `0.01` gives
`0.53`, never `0.53000001`.

A typed value is not corrected. A number outside the bounds or off the step
stays in the field and fails validation, so `onValueChange` reports
`valid: false` and a form does not submit it.

## Turn off scrubbing or the buttons

Pass `scrub={false}` to keep text selection by dragging on an unfocused field.
Pass `steppers={false}` to hide the step buttons. The arrow keys still step the
value.

```tsx
<InputNumber label="No step buttons" defaultValue={4} steppers={false} />
<InputNumber label="No scrubbing" defaultValue={4} scrub={false} />
```

## Size, status, and state

`size`, `status`, `hint`, `priority`, `round`, `leading`, `trailing`,
`disabled`, and `readOnly` match [Input](./input.md). A disabled or read-only field
does not scrub or step.

```tsx
<InputNumber label="Small" size="small" defaultValue={8} />
<InputNumber label="Seats" status="critical" hint="Choose at least 1 seat." defaultValue={0} min={1} />
<InputNumber label="Large" size="large" defaultValue={255} max={255} />
<InputNumber label="Disabled" defaultValue={4} disabled />
```

## Controlled values

Update `value` from `onValueChange` to control the number. The callback runs on
every scrub step, button step, and keystroke with `event.type` of `input`, and
once more with `change` when a scrub ends, a button is released, or an edit is
committed. Save on `change` when each write is expensive.

`value` is `null` while the field is empty or holds text that is not a number
yet, such as a lone minus sign or `2.` in some browsers. The field keeps that
text while it is focused, so the next keystroke completes it.

```tsx
const [opacity, setOpacity] = useState<number | null>(50)

<InputNumber
  label="Opacity"
  min={0}
  max={100}
  value={opacity}
  onValueChange={(event, { value }) => {
    setOpacity(value)
    if (event.type === 'change') save(value)
  }}
/>
```

## InputNumber props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoComplete?` | 'off' \| 'on' \| 'name' \| 'username' \| 'email' \| 'current-password' \| 'new-password' \| 'one-time-code' \| 'tel' \| 'url' \| (string & {}) | — | Native autocomplete token describing the field purpose. Overrides the token derived from the email, tel, or url type. Set an explicit token for other purposes, such as `username`, `current-password`, or `one-time-code`. |
| `autoFocus?` | boolean | — | Focus this field when its containing `Dialog` opens. |
| `children?` | ReactNode | — | Extra content between the field and hint. A `Tooltip` child anchors to the field. Use `leading` and `trailing` for content inside the field. |
| `defaultValue?` | number \| null | — | Initial value for an uncontrolled field. Form reset restores it. |
| `dimActions?` | boolean | — | Keep leading, trailing, and clear content subtle until someone hovers over or focuses the field. |
| `disabled?` | boolean | — | Disable the field. |
| `form?` | string | — | ID of the form to associate with when outside that form. |
| `hint?` | ReactNode | — | Persistent help or feedback below the field. `status` colors the message and adds a status icon. |
| `inputMode?` | 'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url' | — | Virtual keyboard hint. Overrides the value derived from `type` without changing validation. |
| `label?` | ReactNode | — | Explain what to enter. Accepts text or JSX and also names the field for screen readers. |
| `leading?` | ReactNode | — | Content at the start of the field, such as an icon or text. |
| `max?` | number | — | Highest permitted value. Scrubbing and the step buttons stop here; a typed value above it fails validation. |
| `min?` | number | — | Lowest permitted value. Scrubbing and the step buttons stop here; a typed value below it fails validation. |
| `name?` | string | — | Form field name for submission, named form lookup, and attribute selectors. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onChange?` | (e) => void | — | Fires on native commit, such as blur or Enter, and on clear. Use `onInput` or `onValueChange` for live edits. Read `e.target.value`. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onFormReset?` | (e) => void | — | Fires on form reset before the field handles it. Prevent the default to let a composed field restore its own value and displayed text. Button-mode triggers preserve their text when no handler takes ownership. |
| `onInput?` | (e) => void | — | Fires when editing changes the value or the field is cleared. Read `e.target.value`. |
| `onValueChange?` | (event, attrs) => void | — | Receive the current number, field name, and validation result while editing, scrubbing, or stepping, and when an edit is committed. Use `event.type` to distinguish `input` from `change`. |
| `placeholder?` | string | — | Placeholder shown when empty. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | primary | Field emphasis. `primary` has a fill and border, `secondary` keeps the border without a fill, and `tertiary` makes the border transparent until hover or focus. Status borders remain visible at rest. |
| `readOnly?` | boolean | — | Make the field read-only. |
| `required?` | boolean | — | Mark the field required. Button mode checks the submitted value: null, an empty string, or an empty array is missing, independently of the label. |
| `role?` | string | — | ARIA role for the native control, such as `combobox` for an InputAutocomplete trigger. The element delegates this and standard `aria-*` props to its native shadow control. |
| `round?` | boolean \| number \| string | — | Give the field fully rounded corners. Pass a number in pixels or a CSS length for a custom radius. The clear button stays circular. |
| `scrub?` | boolean | true | Change the value by dragging horizontally on the unfocused field. Hold Shift for ten steps at a time or Alt for a tenth of a step. A click focuses the field for typing. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Adjust the field, text, icons, and action buttons together to suit the surrounding interface. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Feedback for the field and hint. Use `critical` for an error that must be fixed before submission. Other statuses provide feedback without adding a validation error. Required fields and other validation rules still apply. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Icon before the hint. The defaults are `warning-diamond` for critical, `warning-triangle` for warning, `circle-check` for success, `info` for info, and `circle-small-solid` for brand. Pass a shape to replace it or `false` to hide it. Neutral has no default icon. |
| `step?` | number | 1 | Increment for scrubbing, the step buttons, and the arrow keys. A typed value off the step fails validation. |
| `steppers?` | boolean | true | Show step buttons at the end of the field. Hold one to repeat; hold Shift for ten steps at a time. |
| `tone?` | string | — | Custom CSS border color. A non-neutral `status` takes precedence. The focus ring uses the global `--focus-ring`. |
| `trailing?` | ReactNode | — | Content at the end of the field, after the clear button. Anta buttons fit the field height and keep their padding. Icon-only Buttons are square; text buttons keep their natural width. Pass buttons directly or in a fragment for compact spacing. Other wrapping elements keep the text inset. Override either inset with the `--input-trailing-inset` CSS property. |
| `value?` | number \| null | — | Controlled value. Pass `null` for an empty field. Update it with `onValueChange`. |

## Web Component

Outside JSX, use `<a-input type="number">` with the `scrub` and `steppers`
attributes. Each works alone. Slots, parts, and form behavior are those of
[Input](./input.md#web-component).

Scrubbing and stepping edit the native control, so they fire `input` on each
change and `change` when the gesture ends, as typing does. Read the number from
the host's `value`, which is a string.

For styles and renderer setup, follow [Install and configure](../install-config.md).

```html
<a-input type="number" scrub steppers name="quantity" defaultvalue="12" min="0">
  <span slot="label">Quantity</span>
</a-input>
```

## Styling

InputNumber renders an `<a-input>`, so [Input's styling](./input.md#styling)
applies, including `status`, `tone`, and the `field` and `input` parts. The step
buttons add the `steppers` part for the pair and `step`, `step-up`, and
`step-down` for the buttons. The host matches `:state(scrub)` while scrubbing is
available and `:state(scrubbing)` during a drag. Unlayered consumer rules
override Anta's defaults.

```css
/* The class is only for the demo. Use your own selector. */
.wide-steps::part(steppers) { inline-size: 24px; border-inline-start: 1px solid var(--border-3); }
.wide-steps:state(scrubbing)::part(input) { color: var(--text-2-brand); }
```
