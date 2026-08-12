// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import TabsHost from './TabsHost.svelte'

describe('Tabs', () => {
  it('renders tab links and marks the active one with aria-current', () => {
    const { getByText } = render(TabsHost, { props: { pathname: '/a' } })

    const alpha = getByText('Alpha').closest('a') as HTMLAnchorElement
    const beta = getByText('Beta').closest('a') as HTMLAnchorElement
    expect(alpha.getAttribute('href')).toBe('/a')
    expect(beta.getAttribute('href')).toBe('/b')
    expect(alpha.getAttribute('aria-current')).toBe('page')
    expect(beta.getAttribute('aria-current')).toBeNull()
  })

  it('renders the active tab toolbar and content', () => {
    const { getByTestId } = render(TabsHost, { props: { pathname: '/a' } })

    expect(getByTestId('toolbar-alpha').textContent).toBe('world')
    expect(getByTestId('content-alpha').textContent).toBe('world')
    expect(document.querySelector('[data-testid="toolbar-beta"]')).toBeNull()
    expect(document.querySelector('[data-testid="content-beta"]')).toBeNull()
  })

  it('switches toolbar and content when the pathname changes', () => {
    const { getByTestId } = render(TabsHost, { props: { pathname: '/b' } })

    expect(getByTestId('toolbar-beta').textContent).toBe('beta-toolbar')
    expect(getByTestId('content-beta').textContent).toBe('beta-content')
    expect(document.querySelector('[data-testid="toolbar-alpha"]')).toBeNull()
    expect(document.querySelector('[data-testid="content-alpha"]')).toBeNull()
  })

  it('falls back to the first tab when the pathname matches no tab', () => {
    const { getByTestId } = render(TabsHost, { props: { pathname: '/unknown' } })

    expect(getByTestId('toolbar-alpha')).toBeTruthy()
    expect(getByTestId('content-alpha')).toBeTruthy()
  })
})
