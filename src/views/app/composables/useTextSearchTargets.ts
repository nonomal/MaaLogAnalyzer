import { computed, ref, shallowRef } from 'vue'
import { matchPrimaryLogFile, sortLoadedPrimaryLogSegments } from '../../../utils/logFileDiscovery'

export interface TextSearchLoadedTarget {
  id: string
  label: string
  fileName: string
  content: string
}

export interface DeferredTextSearchTarget {
  id: string
  label: string
  fileName: string
  loadContent: () => Promise<string>
}

export const useTextSearchTargets = () => {
  const textSearchLoadedTargets = shallowRef<TextSearchLoadedTarget[]>([])
  const textSearchLoadedDefaultTargetId = ref<string>('')
  const deferredTextSearchTargets = shallowRef<DeferredTextSearchTarget[]>([])
  const deferredTextSearchDefaultTargetId = ref<string>('')
  const textSearchTargetsHydrated = ref(false)
  const hasDeferredTextSearchTargets = computed(() => deferredTextSearchTargets.value.length > 0)
  let hydrateTextSearchTargetsToken = 0

  const setTextSearchLoadedTargets = (targets: TextSearchLoadedTarget[], defaultId?: string) => {
    textSearchLoadedTargets.value = targets
    textSearchLoadedDefaultTargetId.value = defaultId ?? (targets[0]?.id ?? '')
  }

  const pickPreferredLogTargetId = (targets: TextSearchLoadedTarget[]): string => {
    if (targets.length === 0) return ''

    const primaryTargets = targets
      .map((target) => ({
        target,
        candidate: matchPrimaryLogFile(target.label || target.fileName, target.fileName),
      }))
      .filter((entry): entry is { target: TextSearchLoadedTarget; candidate: NonNullable<ReturnType<typeof matchPrimaryLogFile>> } => entry.candidate != null)

    const preferredMain = primaryTargets.find(
      entry => entry.candidate.kind === 'main' && entry.candidate.normalizedName === 'maafw.log',
    ) ?? primaryTargets.find(
      entry => entry.candidate.kind === 'main' && entry.candidate.normalizedName === 'maa.log',
    )
    if (preferredMain) {
      return preferredMain.target.id
    }

    if (primaryTargets.length > 0) {
      const sortedBakTargets = sortLoadedPrimaryLogSegments(primaryTargets.map((entry) => ({
        id: entry.target.id,
        path: entry.target.label || entry.target.fileName,
        name: entry.target.fileName,
        content: entry.target.content,
      })))
      return sortedBakTargets[sortedBakTargets.length - 1]?.id ?? primaryTargets[0].target.id
    }

    return targets[0].id
  }

  const clearDeferredTextSearchTargets = () => {
    deferredTextSearchTargets.value = []
    deferredTextSearchDefaultTargetId.value = ''
    textSearchTargetsHydrated.value = false
  }

  const hydrateDeferredTextSearchTargets = async () => {
    if (textSearchTargetsHydrated.value) return
    const deferredTargets = deferredTextSearchTargets.value
    if (deferredTargets.length === 0) {
      textSearchTargetsHydrated.value = true
      setTextSearchLoadedTargets([])
      return
    }

    const token = ++hydrateTextSearchTargetsToken
    const loadedTargets: TextSearchLoadedTarget[] = []
    for (const target of deferredTargets) {
      try {
        const content = await target.loadContent()
        if (token !== hydrateTextSearchTargetsToken) return
        loadedTargets.push({
          id: target.id,
          label: target.label,
          fileName: target.fileName,
          content,
        })
      } catch (error) {
        console.warn('[text-search] load deferred target failed:', target.id, error)
      }
    }
    if (token !== hydrateTextSearchTargetsToken) return

    const defaultId = deferredTextSearchDefaultTargetId.value && loadedTargets.some((target) => target.id === deferredTextSearchDefaultTargetId.value)
      ? deferredTextSearchDefaultTargetId.value
      : pickPreferredLogTargetId(loadedTargets)
    setTextSearchLoadedTargets(loadedTargets, defaultId)
    textSearchTargetsHydrated.value = true
  }

  const ensureTextSearchTargetsHydrated = async () => {
    await hydrateDeferredTextSearchTargets()
  }

  const setDeferredTextSearchTargets = (targets: DeferredTextSearchTarget[], defaultId?: string) => {
    hydrateTextSearchTargetsToken++
    deferredTextSearchTargets.value = targets
    deferredTextSearchDefaultTargetId.value = defaultId ?? (targets[0]?.id ?? '')
    textSearchTargetsHydrated.value = false
    setTextSearchLoadedTargets([])
  }

  return {
    textSearchLoadedTargets,
    textSearchLoadedDefaultTargetId,
    hasDeferredTextSearchTargets,
    setTextSearchLoadedTargets,
    pickPreferredLogTargetId,
    clearDeferredTextSearchTargets,
    ensureTextSearchTargetsHydrated,
    setDeferredTextSearchTargets,
  }
}
