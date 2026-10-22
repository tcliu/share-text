<script lang="ts">
  import Button from '$lib/components/Button.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import ColumnsIcon from '$lib/icons/ColumnsIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import { createFocusoutClose } from '$lib/actions/use-focusout-close'
  import { useDropdown } from '$lib/actions/use-dropdown.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'

  export interface ChooserColumn {
    key: string
    header: string
    checked: boolean
  }

  interface Props {
    /** Accessible name and tooltip for the icon trigger; passed translated. */
    triggerLabel: string
    /** Accessible name and tooltip for the reset button; passed translated. */
    resetAriaLabel: string
    columns: ChooserColumn[]
    onToggle: (key: string, checked: boolean) => void
    onReset: () => void
    size?: SizeInput
  }

  let { triggerLabel, resetAriaLabel, columns, onToggle, onReset, size = 'md' }: Props = $props()

  let open = $state(false)
  let containerRef = $state<HTMLSpanElement | null>(null)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)

  function close(focusTrigger = false) {
    open = false
    if (focusTrigger) triggerRef?.focus()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      // Close before viewer-level Escape handling runs, then keep focus.
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }

  const handleFocusOut = createFocusoutClose(
    () => open,
    () => ({ container: containerRef, panel: panelRef }),
    () => close(),
  )

  useDropdown(() => ({
    isOpen: () => open,
    container: () => containerRef,
    onOutsideClick: () => close(),
    // Escape from anywhere (trigger or panel) closes and restores focus so
    // unmounting the panel never drops focus to the body.
    onEscape: () => close(true),
    panel: () => panelRef,
  }))
</script>

<span class="colchooser relative inline-flex gap-1" bind:this={containerRef} onfocusout={handleFocusOut}>
  {#snippet triggerIcon()}
    <ColumnsIcon />
  {/snippet}
  {#snippet resetIcon()}
    <RefreshIcon />
  {/snippet}
  <Button
    variant="ghost"
    size={size}
    ariaLabel={triggerLabel}
    tooltip={triggerLabel}
    ariaExpanded={open}
    onClick={() => (open = !open)}
    onKeyDown={handleKeydown}
    bind:buttonEl={triggerRef}
    icon={triggerIcon} />
  <Button
    variant="ghost"
    size={size}
    ariaLabel={resetAriaLabel}
    tooltip={resetAriaLabel}
    onClick={() => onReset()}
    icon={resetIcon} />
  {#if open}
    <!-- Prevent the focus shift on row pointerdown (as the shared Menu options
         do) so focusout-close cannot win the race with the label click. -->
    <div
      bind:this={panelRef}
      use:positionPanel={() => ({ getTrigger: () => triggerRef, getOpen: () => open, align: 'right' })}
      class="panel fixed top-0 left-0 z-40 max-h-[50dvh] min-w-36 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl shadow-slate-950/60 backdrop-blur will-change-transform"
      role="group"
      aria-label={triggerLabel}
      onpointerdown={event => event.preventDefault()}>
      {#each columns as column (column.key)}
        <div class="chooser-row rounded px-1.5 py-0.5 whitespace-nowrap hover:bg-slate-800">
          <Checkbox
            checked={column.checked}
            label={column.header}
            size={size}
            onChange={checked => onToggle(column.key, checked)} />
        </div>
      {/each}
    </div>
  {/if}
</span>
