<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import type { AdminUser } from '$lib/admin'
  import type { UserDialogInput } from '$lib/use-admin-users.svelte'

  interface Props {
    mode: 'add' | 'edit'
    user?: AdminUser | null
    pending?: boolean
    onSave: (input: UserDialogInput) => void
    onClose: () => void
  }

  let { mode, user, pending = false, onSave, onClose }: Props = $props()

  let username = $state('')
  let email = $state('')
  let password = $state('')
  let active = $state(true)
  let discardPromptOpen = $state(false)

  $effect(() => {
    username = user?.username ?? ''
    email = user?.email ?? ''
    password = ''
    active = user?.status !== 'inactive'
  })

  const valid = $derived(
    username.trim().length > 0 && email.trim().length > 0 && (mode === 'edit' || password.length > 0),
  )

  const dirty = $derived(
    username !== (user?.username ?? '') ||
      email !== (user?.email ?? '') ||
      password.length > 0 ||
      active !== (user?.status !== 'inactive'),
  )

  const okDisabled = $derived(mode === 'add' ? !valid : !valid || !dirty)

  function handleReset() {
    username = user?.username ?? ''
    email = user?.email ?? ''
    password = ''
    active = user?.status !== 'inactive'
  }

  function handleCancelRequest() {
    if (discardPromptOpen) return
    if (dirty) {
      discardPromptOpen = true
      return
    }
    onClose()
  }

  function handleDiscard() {
    discardPromptOpen = false
    onClose()
  }

  function handleSave() {
    if (okDisabled) {
      return
    }
    onSave({
      username: username.trim(),
      email: email.trim(),
      password,
      status: active ? 'active' : 'inactive',
    })
  }
</script>

<BaseDialog
  title={mode === 'add' ? 'Add User' : 'Edit User'}
  maxWidth="md"
  onCancel={handleCancelRequest}
  dismissKeydownCapture={!discardPromptOpen}
  pending={pending}>
  <div class="flex flex-col gap-4">
    <FormField label="Username" htmlFor="user-username">
      <input
        id="user-username"
        bind:value={username}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label="Email" htmlFor="user-email">
      <input
        id="user-email"
        bind:value={email}
        type="email"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label="Password" htmlFor="user-password">
      <PasswordInput id="user-password" bind:value={password} disabled={pending} />
      {#if mode === 'edit'}
        <p class="mt-1 text-xs text-slate-500">Leave blank to keep the current password.</p>
      {/if}
    </FormField>
    <FormField label="Status">
      <SelectDropdown
        buttonLabel={active ? 'Active' : 'Inactive'}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
        activeValue={active ? 'active' : 'inactive'}
        ariaLabel="Status"
        onSelect={value => (active = value === 'active')} />
    </FormField>
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleSave} disabled={okDisabled} pending={pending}>
          {mode === 'add' ? 'Create' : 'OK'}
        </Button>
        {#if mode === 'edit'}
          <Button variant="outline" onClick={handleReset} disabled={!dirty || pending}>Reset</Button>
        {/if}
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="You have unsaved changes to this user that will be lost."
    confirmLabel="Discard"
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
