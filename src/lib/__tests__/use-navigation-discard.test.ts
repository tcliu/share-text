// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beforeNavigate, goto } from '$app/navigation'
import { useNavigationDiscard } from '../use-navigation-discard.svelte'

interface FakeNavigation {
  to?: { url: URL }
  cancel: () => void
}

// The composable registers its hook at setup, so the test captures the
// callback the mocked `$app/navigation` received and drives a navigation with
// it.
function setup(options: {
  isDirty: () => boolean
  onDiscard: () => void
  keepsDraft?: (pathname: string) => boolean
}) {
  const guard = useNavigationDiscard(options)
  const register = vi.mocked(beforeNavigate).mock.lastCall?.[0] as
    | ((navigation: FakeNavigation) => void)
    | undefined
  if (!register) throw new Error('useNavigationDiscard did not register a navigation hook')
  return { guard, navigate: (navigation: FakeNavigation) => register(navigation) }
}

function destination(path: string) {
  const cancel = vi.fn<() => void>()
  return { cancel, navigation: { to: { url: new URL(path, 'http://localhost') }, cancel } }
}

beforeEach(() => {
  vi.mocked(beforeNavigate).mockClear()
  vi.mocked(goto).mockClear()
})

describe('useNavigationDiscard', () => {
  it('lets a clean draft navigate without prompting', () => {
    const { guard, navigate } = setup({ isDirty: () => false, onDiscard: vi.fn() })
    const { cancel, navigation } = destination('/documents')
    navigate(navigation)
    expect(cancel).not.toHaveBeenCalled()
    expect(guard.discardPromptOpen).toBe(false)
  })

  it('cancels a dirty draft navigation and opens the prompt', () => {
    const { guard, navigate } = setup({ isDirty: () => true, onDiscard: vi.fn() })
    const { cancel, navigation } = destination('/documents?page=2')
    navigate(navigation)
    expect(cancel).toHaveBeenCalledOnce()
    expect(guard.discardPromptOpen).toBe(true)
  })

  it('keeps the draft alive on a navigation that shares the page state', () => {
    const { guard, navigate } = setup({
      isDirty: () => true,
      onDiscard: vi.fn(),
      keepsDraft: pathname => pathname === '/settings',
    })
    const { cancel, navigation } = destination('/settings?tab=general')
    navigate(navigation)
    expect(cancel).not.toHaveBeenCalled()
    expect(guard.discardPromptOpen).toBe(false)
  })

  it('discards the draft and resumes the remembered navigation on confirm', () => {
    const onDiscard = vi.fn()
    const { guard, navigate } = setup({ isDirty: () => true, onDiscard })
    const { navigation } = destination('/documents?page=2')
    navigate(navigation)
    guard.confirmDiscard()
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(goto).toHaveBeenCalledWith('/documents?page=2')
    expect(guard.discardPromptOpen).toBe(false)
    // The discard must land before the navigation resumes.
    expect(onDiscard.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(goto).mock.invocationCallOrder[0]!,
    )
  })

  it('prompts when the kept-path predicate rejects the target', () => {
    const { guard, navigate } = setup({
      isDirty: () => true,
      onDiscard: vi.fn(),
      keepsDraft: () => false,
    })
    const { cancel, navigation } = destination('/elsewhere')
    navigate(navigation)
    expect(cancel).toHaveBeenCalledOnce()
    expect(guard.discardPromptOpen).toBe(true)
  })

  it('confirms at most once, so a double click cannot re-discard or re-navigate', () => {
    const onDiscard = vi.fn()
    const { guard, navigate } = setup({ isDirty: () => true, onDiscard })
    navigate(destination('/documents').navigation)
    guard.confirmDiscard()
    guard.confirmDiscard()
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(goto).toHaveBeenCalledOnce()
  })

  it('ignores a navigation with no target url', () => {
    const { guard, navigate } = setup({ isDirty: () => true, onDiscard: vi.fn() })
    const cancel = vi.fn<() => void>()
    navigate({ cancel })
    expect(cancel).not.toHaveBeenCalled()
    expect(guard.discardPromptOpen).toBe(false)
  })

  it('confirms nothing when no navigation is pending', () => {
    const onDiscard = vi.fn()
    const { guard } = setup({ isDirty: () => false, onDiscard })
    guard.confirmDiscard()
    expect(onDiscard).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  })
})
