import { reactive, readonly } from 'vue'

export type ContributorContributionInput = string[] | Record<string, number>

const registrations = new Map<string, symbol>()
const sources = reactive(new Map<string, Record<string, number>>())

export function registerContributorContributions(sourceId: string, input: ContributorContributionInput) {
  const counts = Array.isArray(input)
    ? input.reduce<Record<string, number>>((result, name) => {
        result[name] = (result[name] || 0) + 1
        return result
      }, Object.create(null))
    : { ...input }

  for (const [name, count] of Object.entries(counts)) {
    if (!Number.isFinite(count) || count < 0) throw new Error(`贡献登记 ${sourceId}.${name} 必须是非负有限数值`)
  }
  const token = Symbol(sourceId)
  registrations.set(sourceId, token)
  sources.set(sourceId, counts)
  return () => {
    if (registrations.get(sourceId) !== token) return
    registrations.delete(sourceId)
    sources.delete(sourceId)
  }
}

export function useContributorContributionSources() {
  return readonly(sources)
}
