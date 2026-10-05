export interface PageSelection {
  readonly selectedIds: Set<string>
  readonly selectedCount: number
  readonly currentPageAllSelected: boolean
  readonly currentPageSomeSelected: boolean
  toggleSelection(id: string, checked: boolean): void
  toggleAllOnCurrentPage(): void
  remove(ids: Iterable<string>): void
  clear(): void
  reset(): void
}

/**
 * Shared list-selection state for the admin tables (documents, users). The
 * owner supplies the current page's row ids so "select all on page" and the
 * derived all/some flags always read the visible rows.
 */
export function createPageSelection(getCurrentPageIds: () => string[]): PageSelection {
  let selectedIds = $state<Set<string>>(new Set())

  function toggleSelection(id: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    selectedIds = next
  }

  function toggleAllOnCurrentPage() {
    const pageIds = getCurrentPageIds()
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) {
      for (const id of pageIds) {
        next.delete(id)
      }
    } else {
      for (const id of pageIds) {
        next.add(id)
      }
    }
    selectedIds = next
  }

  function remove(ids: Iterable<string>) {
    const next = new Set(selectedIds)
    for (const id of ids) {
      next.delete(id)
    }
    selectedIds = next
  }

  function clear() {
    selectedIds = new Set()
  }

  function reset() {
    selectedIds = new Set()
  }

  return {
    get selectedIds() {
      return selectedIds
    },
    get selectedCount() {
      return selectedIds.size
    },
    get currentPageAllSelected() {
      const pageIds = getCurrentPageIds()
      return pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
    },
    get currentPageSomeSelected() {
      return getCurrentPageIds().some(id => selectedIds.has(id))
    },
    toggleSelection,
    toggleAllOnCurrentPage,
    remove,
    clear,
    reset,
  }
}
