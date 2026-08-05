export function useAdminDocumentsSearch(params: { onParamsChange: () => void }) {
  const { onParamsChange } = params

  let searchQuery = $state('')
  let searchInput = $state('')
  let searchKeys = $state<string[]>([])
  let sortBy = $state('updatedAt')
  let sortDir = $state<'asc' | 'desc'>('desc')
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  function handleSearchInput() {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      searchQuery = searchInput.trim()
      onParamsChange()
    }, 400)
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
      searchQuery = searchInput.trim()
      onParamsChange()
    } else if (event.key === 'Escape') {
      searchInput = ''
      searchQuery = ''
      onParamsChange()
    }
  }

  function handleSort(key: string, direction: 'asc' | 'desc') {
    sortBy = key
    sortDir = direction
    onParamsChange()
  }

  return {
    get searchQuery() {
      return searchQuery
    },
    get searchInput() {
      return searchInput
    },
    set searchInput(value: string) {
      searchInput = value
    },
    get searchKeys() {
      return searchKeys
    },
    set searchKeys(value: string[]) {
      searchKeys = value
    },
    get sortBy() {
      return sortBy
    },
    get sortDir() {
      return sortDir
    },
    handleSearchInput,
    handleSearchKeydown,
    handleSort,
    destroy() {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
    },
  }
}
