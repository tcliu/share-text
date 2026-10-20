// The one base text-field chrome shared by every text-like input. `TextInput`
// renders the canonical `<input>`; `PasswordInput`/`SearchInput`/`NumberInput`
// compose it, and `TextArea` imports these directly because a `<textarea>` cannot
// compose an `<input>`. Keep the chrome here so no input re-declares it.

// The border and the focus color that accompanies it; a field embedded in
// another surface drops both together (see `INPUT_EMBEDDED`).
const INPUT_BORDER = 'border border-slate-700 focus:border-cyan-500'

// Surface, text, placeholder, disabled, read-only, and motion, shared by the
// bordered chrome.
const INPUT_SURFACE =
  'w-full bg-slate-950 text-slate-100 transition outline-none placeholder:text-slate-500 disabled:opacity-40 read-only:cursor-default read-only:text-slate-400 motion-reduce:transition-none'

// The canonical bordered chrome.
export const INPUT_CHROME = `${INPUT_BORDER} ${INPUT_SURFACE}`

// The chrome of a field embedded in another surface (a tag row, a select
// trigger, a stepper-less numeric field): the container owns the border, the
// background, and the focus ring, so the field drops all three and keeps only
// what it owns. The text rules (color, placeholder, disabled) belong to the
// field, so the caller adds them.
export const INPUT_EMBEDDED = 'bg-transparent outline-none'

// The `--input-*` metric classes; the size-metric custom properties they consume
// are set inline by the component.
export const INPUT_METRIC_CLASS =
  'rounded-[var(--input-radius)] py-[var(--input-pad-y)] px-[var(--input-pad-x)] text-[length:var(--input-font)] leading-[var(--input-line)]'

// Every metric is a fixed ratio of the size dimension, so each keeps a constant
// metric:dimension ratio across the whole range.
export const INPUT_RATIOS = { font: 0.8125, line: 1.1875, radius: 0.375, padX: 0.5625, padY: 0.39375 }
