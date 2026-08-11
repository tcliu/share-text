export const page: { params: Record<string, string>; url: URL; route: { id: string } } = {
  params: {},
  url: new URL('http://localhost/'),
  route: { id: '/' },
}

export function setPageState(value: { params?: Record<string, string>; url?: URL; route?: { id: string } }) {
  if (value.params) page.params = value.params
  if (value.url) page.url = value.url
  if (value.route) page.route = value.route
}
