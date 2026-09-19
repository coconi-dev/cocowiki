import { reactive, readonly } from 'vue'

export type ContributorContributionInput = string[] | Record<string, number>

const sources = reactive(new Map<string, Record<string, number>>())

export function registerContributorContributions(sourceId: string, input: ContributorContributionInput) {
  const counts = Array.isArray(input)
    ? input.reduce<Record<string, number>>((result, name) => {
        result[name] = (result[name] || 0) + 1
        return result
      }, {})
    : { ...input }

  sources.set(sourceId, counts)
  return () => sources.delete(sourceId)
}

export function useContributorContributionSources() {
  return readonly(sources)
}
