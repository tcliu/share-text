// Shared clipboard behavior for the copy affordances (`Copyable`,
// `EditableText`): the button itself is the shared `Button` + `CopyIcon`, so
// only the write-and-report step lives here instead of being re-implemented at
// each call site.

import { toast } from 'svelte-sonner'

export interface CopyMessages {
  copied: string
  failed: string
}

// Writes `text` to the clipboard and reports the outcome through `toast`. A
// clipboard error is surfaced with its own message when it carries one,
// falling back to the localized failure string.
export async function copyToClipboard(text: string, messages: CopyMessages): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(messages.copied)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : messages.failed)
  }
}
