<script lang="ts">
  import { onMount, tick } from 'svelte'
  import FormDialog from '@codepg/ui-lib/components/FormDialog.svelte'
  import FormField from '@codepg/ui-lib/components/FormField.svelte'
  import PasswordInput from '@codepg/ui-lib/components/PasswordInput.svelte'
  import SelectDropdown from '@codepg/ui-lib/components/SelectDropdown.svelte'
  import { caretAtEndOnKeyboardFocus } from '@codepg/ui-lib/actions/caret-at-end-on-keyboard-focus'
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

<FormDialog
  title={mode === 'add' ? i18n.t('admin.dialog.addUser') : i18n.t('admin.dialog.editUser')}
  widthVariant="md"
  closeLabel={i18n.t('common.closeDialog')}
  saveLabel={mode === 'add' ? i18n.t('admin.dialog.create') : i18n.t('common.ok')}
  resetLabel={mode === 'edit' ? i18n.t('common.reset') : undefined}
  discardTitle={i18n.t('admin.dialog.discardTitle')}
  discardMessage={i18n.t('admin.dialog.discardUser')}
  discardLabel={i18n.t('admin.discard')}
  {dirty}
  confirmOnDismiss
  saveDisabled={!valid}
  {pending}
  onSave={handleSave}
  onReset={handleReset}
  onClose={onClose}>
  <div class="flex flex-col gap-4" use:caretAtEndOnKeyboardFocus>
    <FormField label={i18n.t('admin.users.username')} htmlFor="user-username">
      <input
        id="user-username"
        bind:this={usernameInput}
        bind:value={username}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition outline-none focus:border-cyan-500" />
    </FormField>
    <FormField label={i18n.t('admin.users.email')} htmlFor="user-email">
      <input
        id="user-email"
        bind:value={email}
        type="email"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition outline-none focus:border-cyan-500" />
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
        onSelect={value => (active = value === 'active')}
        emptyLabel={i18n.t('dropdown.noOptions')} />
    </FormField>
  </div>
</FormDialog>
