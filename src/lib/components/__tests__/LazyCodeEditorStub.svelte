<script lang="ts">
  interface Props {
    content?: string
    editorAriaLabel?: string
  }

  let { content = $bindable(), editorAriaLabel = 'Content' }: Props = $props()
</script>

<textarea aria-label={editorAriaLabel} data-testid="content-editor" bind:value={content}></textarea>
