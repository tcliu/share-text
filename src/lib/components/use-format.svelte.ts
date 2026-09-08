import { toast } from 'svelte-sonner'
import type { FormatSpec } from '$lib/document-types'
import { getI18nContext } from '$lib/i18n.svelte'

export function useFormat(options: {
  format: () => FormatSpec | undefined
  content: () => string
  setContent: (value: string) => void
  label: () => string
}) {
  const i18n = getI18nContext()
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
      toast.error(i18n.t('editor.toast.cannotFormat', { error: result.error ?? i18n.t('doc.toast.invalidType', { label: options.label() }) }))
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
