<script lang="ts">
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
</script>

<div class="flex h-full flex-1 items-center justify-center p-4">
  <p class="text-sm text-slate-400">{i18n.t('empty.prompt')}</p>
</div>
