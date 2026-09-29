import { toast } from 'svelte-sonner'
import { getDocumentType } from '$lib/document-types'
import { getI18nContext } from '$lib/i18n.svelte'

const MAX_UPLOAD_BYTES = 1024 * 1024

// Owns the editor toolbar's document actions: file upload, export, copy, and
// document-type conversion. Instantiated during component init so
// `getI18nContext()` resolves the surrounding component's context.
export function useDocumentActions(options: {
  getContent: () => string
  setContent: (value: string) => void
  getDocType: () => string
  setDocType: (value: string) => void
  getDocument: () => { id: string; name: string }
  getMaxContentLength: () => number
  getDirty: () => boolean
  onTypeChange: (value: string) => void
}) {
  const i18n = getI18nContext()
  let fileInputRef = $state<HTMLInputElement | null>(null)
  let uploadConfirmOpen = $state(false)

  function openFilePicker() {
    fileInputRef?.click()
  }

  function handleUploadClick() {
    if (options.getDirty()) {
      uploadConfirmOpen = true
      return
    }
    openFilePicker()
  }

  function handleUploadConfirm() {
    uploadConfirmOpen = false
    openFilePicker()
  }

  async function handleFileChange() {
    const file = fileInputRef?.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const byteSize = new TextEncoder().encode(text).byteLength
      if (byteSize > MAX_UPLOAD_BYTES) {
        toast.error(i18n.t('editor.toast.fileTooLarge'))
        return
      }
      const maxContentLength = options.getMaxContentLength()
      if (maxContentLength > 0 && text.length > maxContentLength) {
        toast.error(i18n.t('editor.toast.fileTooLong', { limit: maxContentLength }))
        return
      }
      options.setContent(text)
      toast.success(i18n.t('editor.toast.fileUploaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.t('editor.toast.fileReadFailed'))
    } finally {
      if (fileInputRef) {
        fileInputRef.value = ''
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(options.getContent())
      toast.success(i18n.t('editor.toast.copied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.t('editor.toast.copyFailed'))
    }
  }

  async function handleCopyLink() {
    try {
      const url = new URL(window.location.href)
      url.pathname = `/${options.getDocument().id}`
      url.search = ''
      url.hash = ''
      await navigator.clipboard.writeText(url.toString())
      toast.success(i18n.t('editor.toast.linkCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.t('editor.toast.copyFailed'))
    }
  }

  function handleExport() {
    const docType = options.getDocType()
    const currentType = getDocumentType(docType)
    const blob = new Blob([options.getContent()], { type: `${currentType.mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = `${options.getDocument().name || 'document'}.${currentType.extension}`
    globalThis.document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleTypeSelect(value: string) {
    const docType = options.getDocType()
    if (value === docType) return
    const fromType = getDocumentType(docType)
    if (fromType.convertTo?.target === value) {
      const result = await fromType.convertTo.convert(options.getContent())
      if (!result.ok) {
        toast.error(
          i18n.t('editor.toast.cannotConvert', { error: result.error ?? i18n.t('editor.toast.invalidContent') }),
        )
        return
      }
      options.setContent(result.value ?? '')
    }
    options.setDocType(value)
    options.onTypeChange(value)
  }

  return {
    get fileInputRef() {
      return fileInputRef
    },
    set fileInputRef(value: HTMLInputElement | null) {
      fileInputRef = value
    },
    get uploadConfirmOpen() {
      return uploadConfirmOpen
    },
    closeUploadConfirm() {
      uploadConfirmOpen = false
    },
    handleUploadClick,
    handleUploadConfirm,
    handleFileChange,
    handleExport,
    handleCopy,
    handleCopyLink,
    handleTypeSelect,
  }
}
