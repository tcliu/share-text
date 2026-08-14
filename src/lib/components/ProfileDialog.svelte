<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import type { User } from '$lib/documents'

  interface Props {
    user: User
    onClose: () => void
  }

  let { user, onClose }: Props = $props()
</script>

<BaseDialog title="Profile" maxWidth="md" onCancel={onClose}>
  {#snippet children()}
    <div class="flex items-center gap-4">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300">
        <PersonIcon className="h-6 w-6" />
      </span>
      <div class="min-w-0">
        <h2 class="truncate text-xl font-semibold tracking-tight text-slate-100">{user.username}</h2>
        <p class="truncate text-sm text-slate-400">{user.email}</p>
      </div>
    </div>
  {/snippet}
</BaseDialog>
