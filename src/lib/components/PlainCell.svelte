<script lang="ts">
  interface Props {
    value: string
    className?: string
  }

  let { value, className = '' }: Props = $props()
</script>

<span class="block min-w-0 truncate text-sm {className}">{value}</span>
