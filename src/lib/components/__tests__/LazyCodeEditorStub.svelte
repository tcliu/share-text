<script lang="ts">
  interface Props {
    content?: string
    editorAriaLabel?: string
    onContentChange?: (content: string) => void
  }

  let { content = $bindable(), editorAriaLabel = 'Content', onContentChange }: Props = $props()

  function handleInput(event: Event) {
    const next = (event.currentTarget as HTMLTextAreaElement).value
    content = next
    onContentChange?.(next)
  }
</script>

<textarea aria-label={editorAriaLabel} data-testid="content-editor" oninput={handleInput} value={content}></textarea>
