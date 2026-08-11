import { toast } from 'svelte-sonner'
import type { FormatSpec } from '$lib/document-types'

export function useFormat(options: {
  format: () => FormatSpec | undefined
  content: () => string
  setContent: (value: string) => void
  label: () => string
}) {
  let open = $state(false)

  function openDialog() {
    open = true
  }

  function cancel() {
    open = false
  }

  async function confirm(indent: number) {
    const format = options.format()
    if (!format) return
    const result = await format.format(options.content(), indent)
    if (result.ok) {
      options.setContent(result.value ?? '')
    } else {
      toast.error('Cannot format: ' + (result.error ?? `Invalid ${options.label()}`))
    }
    open = false
  }

  return {
    get open() {
      return open
    },
    openDialog,
    cancel,
    confirm,
  }
}
