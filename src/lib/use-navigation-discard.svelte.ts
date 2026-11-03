import { beforeNavigate, goto } from '$app/navigation'

// A navigation guard for a page that owns a draft: leaving the page with
// unsaved changes asks to discard them first. The caller owns the dirty
// compare, the draft reset, and the prompt's labels; the guard owns the
// cancelled navigation, the remembered target, and the prompt state.
export function useNavigationDiscard(options: {
  isDirty: () => boolean
  onDiscard: () => void
  // Paths that keep the draft alive (in-app navigation that shares the
  // page's state) never prompt.
  keepsDraft?: (pathname: string) => boolean
}) {
  let discardPromptOpen = $state(false)
  let pendingUrl = $state<string | null>(null)

  beforeNavigate(navigation => {
    // Shallow navigations only rewrite the URL of the current page (preview
    // toggles, the login param strip), so they never leave the draft behind.
    if (navigation.shallow) return
    if (!options.isDirty()) return
    const url = navigation.to?.url
    if (!url) return
    if (options.keepsDraft?.(url.pathname)) return
    navigation.cancel()
    pendingUrl = url.pathname + url.search
    discardPromptOpen = true
  })

  // The confirm performs the discard: the drafts reset, then the remembered
  // navigation resumes.
  function confirmDiscard(): void {
    const url = pendingUrl
    pendingUrl = null
    discardPromptOpen = false
    if (!url) return
    options.onDiscard()
    void goto(url)
  }

  return {
    get discardPromptOpen() {
      return discardPromptOpen
    },
    confirmDiscard,
  }
}
