import { Input, type InputChangeAttrs, type InputProps } from './Input'

/** Convenience snapshot passed as the 2nd argument to `onValueChange`. */
export interface InputNumberChangeAttrs {
  /** Current number, or `null` while the field is empty or holds text that is
   *  not yet a number, such as a lone minus sign. */
  value: number | null
  /** The field's `name`, for keyed updates: `s => ({ ...s, [name]: value })`. */
  name?: string
  /** `true` when `value` is `null`. */
  empty: boolean
  /** Whether the field currently passes validation, including `min`, `max`, and
   *  `step`. `undefined` where `ElementInternals` is unsupported. */
  valid?: boolean
  /** Current validation message (`''` when valid). */
  validationMessage: string
}

export interface InputNumberProps
  extends Omit<
    InputProps,
    | 'value' | 'defaultValue' | 'formValue' | 'type' | 'min' | 'max' | 'step' | 'onValueChange'
    | 'multiline' | 'rows' | 'maxRows' | 'button' | 'clearable' | 'truncate'
    | 'pattern' | 'maxLength' | 'minLength' | 'spellCheck' | 'onClearClick' | 'onClearInput'
  > {
  /** Controlled value. Pass `null` for an empty field. Update it with
   * `onValueChange`. */
  value?: number | null
  /** Initial value for an uncontrolled field. Form reset restores it. */
  defaultValue?: number | null
  /** Lowest permitted value. Scrubbing and the step buttons stop here; a typed
   * value below it fails validation. */
  min?: number
  /** Highest permitted value. Scrubbing and the step buttons stop here; a typed
   * value above it fails validation. */
  max?: number
  /** Increment for scrubbing, the step buttons, and the arrow keys. A typed
   * value off the step fails validation.
   * @defaultValue 1 */
  step?: number
  /** Change the value by dragging horizontally on the unfocused field. Hold
   * Shift for ten steps at a time or Alt for a tenth of a step. A click focuses
   * the field for typing.
   * @defaultValue true */
  scrub?: boolean
  /** Show step buttons at the end of the field. Hold one to repeat; hold Shift
   * for ten steps at a time.
   * @defaultValue true */
  steppers?: boolean
  /** Receive the current number, field name, and validation result while
   * editing, scrubbing, or stepping, and when an edit is committed. Use
   * `event.type` to distinguish `input` from `change`. */
  onValueChange?: (event: any, attrs: InputNumberChangeAttrs) => void
}

const text = (value: number | null | undefined) =>
  value === undefined ? undefined : value === null || Number.isNaN(value) ? '' : String(value)

/**
 * Number field built on the native number input. Drag across it to scrub the
 * value, use the step buttons or arrow keys to step it, or type a number.
 *
 * `value` and `onValueChange` use numbers, with `null` for an empty field.
 * Labels, hints, status, sizes, and form behavior match `Input`.
 *
 * @example
 * ```tsx
 * <InputNumber label="Opacity" defaultValue={50} min={0} max={100} />
 * ```
 */
export const InputNumber = ({
  value,
  defaultValue,
  min,
  max,
  step,
  scrub = true,
  steppers = true,
  inputMode,
  onValueChange,
  ...rest
}: InputNumberProps) => {
  // Presence attributes the element reads on a number field.
  const affordances: Record<string, string | undefined> = {
    scrub: scrub ? '' : undefined,
    steppers: steppers ? '' : undefined,
  }
  return (
    <Input
      {...rest}
      {...affordances}
      type="number"
      // The numeric keypad has no decimal key, so fractional steps ask for one.
      inputMode={inputMode ?? (step === undefined || Number.isInteger(step) ? 'numeric' : 'decimal')}
      value={text(value)}
      defaultValue={text(defaultValue)}
      min={min}
      max={max}
      step={step}
      onValueChange={onValueChange && ((event: any, attrs: InputChangeAttrs) => {
        const number = attrs.value === '' ? null : Number(attrs.value)
        onValueChange(event, {
          value: number,
          name: attrs.name,
          empty: number === null,
          valid: attrs.valid,
          validationMessage: attrs.validationMessage,
        })
      })}
    />
  )
}
