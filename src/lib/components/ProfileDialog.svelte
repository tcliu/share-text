<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import type { ProfileIdentity } from '$lib/documents'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    user: ProfileIdentity
    onClose: () => void
  }

  let { user, onClose }: Props = $props()
</script>

<BaseDialog title={t('profile.title')} maxWidth="md" onCancel={onClose}>
  {#snippet children()}
    <div class="flex items-center gap-4">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300">
        <PersonIcon className="h-6 w-6" />
      </span>
      <div class="min-w-0">
        <h2 class="truncate text-xl font-semibold tracking-tight text-slate-100">{user.username}</h2>
        {#if user.email}
          <p class="truncate text-sm text-slate-400">{user.email}</p>
        {/if}
      </div>
    </div>
  {/snippet}
</BaseDialog>
