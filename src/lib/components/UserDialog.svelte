<script lang="ts">
  import { onMount, tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import type { AdminUser } from '$lib/admin'
  import type { UserDialogInput } from '$lib/use-admin-users.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

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
  let usernameInput = $state<HTMLInputElement | null>(null)

  onMount(() => {
    tick().then(() => {
      if (usernameInput && !username.trim()) {
        usernameInput.focus()
      }
    })
  })

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
  title={mode === 'add' ? i18n.t('admin.dialog.addUser') : i18n.t('admin.dialog.editUser')}
  maxWidth="md"
  onCancel={handleCancelRequest}
  dismissKeydownCapture={!discardPromptOpen}
  pending={pending}>
  <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
    <FormField label={i18n.t('admin.users.username')} htmlFor="user-username">
      <input
        id="user-username"
        bind:this={usernameInput}
        bind:value={username}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label={i18n.t('admin.users.email')} htmlFor="user-email">
      <input
        id="user-email"
        bind:value={email}
        type="email"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label={i18n.t('auth.password')} htmlFor="user-password">
      <PasswordInput id="user-password" bind:value={password} disabled={pending} />
      {#if mode === 'edit'}
        <p class="mt-1 text-xs text-slate-400">{i18n.t('admin.users.passwordHint')}</p>
      {/if}
    </FormField>
    <FormField label={i18n.t('admin.users.status')}>
      <SelectDropdown
        buttonLabel={active ? i18n.t('admin.active') : i18n.t('admin.inactive')}
        options={[
          { value: 'active', label: i18n.t('admin.active') },
          { value: 'inactive', label: i18n.t('admin.inactive') },
        ]}
        activeValue={active ? 'active' : 'inactive'}
        ariaLabel={i18n.t('admin.users.status')}
        onSelect={value => (active = value === 'active')} />
    </FormField>
    <Buttons align="right">
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleSave} disabled={okDisabled} pending={pending}>
          {mode === 'add' ? i18n.t('admin.dialog.create') : i18n.t('common.ok')}
        </Button>
        {#if mode === 'edit'}
          <Button variant="outline" onClick={handleReset} disabled={!dirty || pending}>{i18n.t('common.reset')}</Button>
        {/if}
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title={i18n.t('admin.dialog.discardTitle')}
    message={i18n.t('admin.dialog.discardUser')}
    confirmLabel={i18n.t('admin.discard')}
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
