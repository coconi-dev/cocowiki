export function normalizeBase(base = '/') {
  const path = base.replace(/^\/+|\/+$/g, '')
  return path ? `/${path}/` : '/'
}

export function routeFromPath(path: string) {
  const stem = path.replace(/\\/g, '/').replace(/(?:\.page\.vue|\.md)$/, '')
  const route = stem === 'index' ? '' : stem.replace(/\/index$/, '/')
  return '/' + route.split('/').map(encodeURIComponent).join('/')
}

export function canonicalRoute(path: string) {
  const pathname = path.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '/')
  return pathname.split('/').map(part => {
    try { return encodeURIComponent(decodeURIComponent(part)) } catch { return part }
  }).join('/')
}
