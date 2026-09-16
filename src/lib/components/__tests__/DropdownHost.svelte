<script lang="ts">
  import SelectDropdown from '../SelectDropdown.svelte'

  let docType = $state('markdown')
  const label = $derived(
    ({ markdown: 'Markdown', html: 'HTML' } as Record<string, string>)[docType],
  )
  const options = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
  ]
</script>

<SelectDropdown
  buttonLabel={label}
  {options}
  activeValue={docType}
  filterable={true}
  emptyLabel="No options"
  onSelect={value => (docType = value)}
/>
