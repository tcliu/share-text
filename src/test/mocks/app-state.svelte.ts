// Stand-in for `$app/state` under vitest. The real module exposes `page` as a
// rune-backed object that navigation replaces, so the mock must be `$state`:
// a plain object would leave `$derived` readers stale after `setPage`.
export const page = $state<{ params: Record<string, string>; url: URL; route: { id: string } }>({
  params: {},
  url: new URL('http://localhost/'),
  route: { id: '/' },
})

export function setPage(value: { params: Record<string, string>; url: URL; route: { id: string } }) {
  page.params = value.params
  page.url = value.url
  page.route = value.route
}
