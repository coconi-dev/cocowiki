import type { ContentPage } from '../shared/content'
import { canonicalRoute } from '../shared/routes'

export function pageResolver(pages: ContentPage[]) {
  const names = new Map(pages.flatMap(page => [page.title, ...(page.aliases || [])].map(name => [name, page] as const)))
  const routes = new Map(pages.map(page => [page.route, page]))
  return (target: string) => target.startsWith('/') ? routes.get(canonicalRoute(target)) : names.get(target)
}
const same = (a: string[] | undefined, b: string[]) => (a || []).join('\0') === b.join('\0')

export function linkPages(pages: ContentPage[], wikiEnabled = true): ContentPage[] {
  const resolve = pageResolver(pages)
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, Set<string>>()
  const related = new Map<string, string[]>()
  for (const page of pages) {
    const targets = wikiEnabled ? page.analysis?.wiki.map(link => resolve(link.target)?.route).filter((route): route is string => Boolean(route) && route !== page.route) || [] : []
    outgoing.set(page.route, [...new Set(targets)].sort())
    for (const target of targets) {
      const sources = incoming.get(target) || new Set<string>()
      sources.add(page.route)
      incoming.set(target, sources)
    }
    related.set(page.route, [...new Set((page.related || []).map(name => resolve(name)?.route).filter((route): route is string => Boolean(route) && route !== page.route))])
  }
  return pages.map(page => {
    const references = outgoing.get(page.route) || []
    const backlinks = [...(incoming.get(page.route) || [])].sort()
    const relatedLinks = related.get(page.route) || []
    return same(page.references, references) && same(page.backlinks, backlinks) && same(page.relatedLinks, relatedLinks)
      ? page : { ...page, references, backlinks, relatedLinks }
  })
}
