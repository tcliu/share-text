<script lang="ts">
  import type { User } from '$lib/documents'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    user: User | null
  }

  let { user }: Props = $props()
</script>

<div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
  <div class="grid gap-3 p-3 md:grid-cols-2">
    <div class="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-400">{t('auth.username')}</div>
      <div class="mt-1 text-sm text-slate-100">{user?.username ?? ''}</div>
    </div>
    <div class="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-400">{t('auth.email')}</div>
      <div class="mt-1 text-sm text-slate-100">{user?.email ?? ''}</div>
    </div>
  </div>
</div>
