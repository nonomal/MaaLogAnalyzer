import { computed, ref, type Ref } from 'vue'
import type { NodeInfo } from '../../../types'
import {
  collectNodeNavMatchDetails,
  getNodeNavMatchKinds,
  normalizeSearchText as normalizeNodeNavMatchText,
  normalizeSearchText,
} from './nodeNavSearch/match'
import {
  formatNodeNavMatchHint,
  formatNodeNavMatchPreview,
} from './nodeNavSearch/format'
import { buildNodeExecutionTimeline } from '@windsland52/maa-log-tools/node-execution-timeline'
import type {
  NodeNavStatus,
  NodeNavViewItem,
} from './nodeNavSearch/types'

export type {
  NodeNavMatchDetail,
  NodeNavMatchKind,
  NodeNavStatus,
  NodeNavViewItem,
} from './nodeNavSearch/types'

export type NodeNavMode = 'pipeline' | 'next-list-hit'

type SourceEntry = {
  node: NodeInfo
  originalIndex: number
  primaryText: string
  primaryMatchKind: 'node' | 'next-list'
  navStatus: NodeNavStatus
}

export const useNodeNavSearch = (
  currentNodes: Ref<NodeInfo[]>,
  selectedRootTaskId: Ref<number | null>,
) => {
  const nodeNavSearchText = ref('')
  const normalizedNodeNavSearchText = computed(() => normalizeSearchText(nodeNavSearchText.value))
  const nodeNavMode = ref<NodeNavMode>('pipeline')
  const nodeNavFailedOnly = ref(false)

  const rootTaskEntries = computed(() => {
    const entries = currentNodes.value.map((node, originalIndex) => ({ node, originalIndex }))
    const rootTaskId = selectedRootTaskId.value
    if (rootTaskId == null) return entries
    return entries.filter((entry) => entry.node.task_id === rootTaskId)
  })

  const pipelineEntries = computed<SourceEntry[]>(() => {
    return currentNodes.value.map((node, originalIndex) => ({
      node,
      originalIndex,
      primaryText: node.name || '未命名节点',
      primaryMatchKind: 'node',
      navStatus: node.status,
    }))
  })

  const recognitionEntries = computed<SourceEntry[]>(() => {
    const timelineItems = buildNodeExecutionTimeline(currentNodes.value, {
      rootTaskId: selectedRootTaskId.value,
    })
    return timelineItems.map((item) => ({
      node: item.nodeInfo,
      originalIndex: item.originalIndex,
      primaryText: item.navName,
      primaryMatchKind: item.matchedRecognitionName ? 'next-list' : 'node',
      navStatus: item.navStatus,
    }))
  })

  const sourceEntries = computed<SourceEntry[]>(() => {
    return nodeNavMode.value === 'pipeline'
      ? pipelineEntries.value
      : recognitionEntries.value
  })

  const appendPrimaryMatches = (entry: SourceEntry, query: string) => {
    const details = collectNodeNavMatchDetails(entry.node, query)
    if (!query) return details

    const withPrimary = normalizeNodeNavMatchText(entry.primaryText).includes(query)
    if (withPrimary) {
      details.unshift({ kind: entry.primaryMatchKind, text: entry.primaryText })
    }

    return details
  }

  const toggleNodeNavFailedOnly = () => {
    nodeNavFailedOnly.value = !nodeNavFailedOnly.value
  }

  const nodeNavItems = computed<NodeNavViewItem[]>(() => {
    const query = normalizedNodeNavSearchText.value
    return sourceEntries.value
      .map((entry) => ({
        node: entry.node,
        originalIndex: entry.originalIndex,
        primaryText: entry.primaryText,
        navStatus: entry.navStatus,
        matchDetails: appendPrimaryMatches(entry, query),
      }))
      .map((item) => {
        const matchKinds = getNodeNavMatchKinds(item.matchDetails)
        return {
          ...item,
          matchKinds,
          matchHint: formatNodeNavMatchHint(matchKinds),
          matchPreview: formatNodeNavMatchPreview(item.matchDetails),
        }
      })
      .filter((item) => {
        if (!nodeNavFailedOnly.value) return true
        if (nodeNavMode.value === 'pipeline') {
          return item.navStatus === 'failed'
        }
        return item.navStatus === 'failed' || item.navStatus === 'timeout' || item.navStatus === 'action-failed'
      })
      .filter((item) => !query || item.matchDetails.length > 0)
  })

  const nodeNavEmptyDescription = computed(() => {
    if (currentNodes.value.length === 0) return '暂无节点数据'
    if (nodeNavMode.value === 'next-list-hit') {
      if (rootTaskEntries.value.length === 0) return '暂无根层节点数据'
      if (recognitionEntries.value.length === 0) return '暂无识别模式节点'
    }
    if (normalizedNodeNavSearchText.value) return '未找到匹配节点'
    if (nodeNavFailedOnly.value) {
      return nodeNavMode.value === 'pipeline' ? '暂无失败节点' : '暂无异常状态节点'
    }
    return '暂无节点数据'
  })

  const setNodeNavMode = (mode: NodeNavMode) => {
    nodeNavMode.value = mode
  }

  return {
    nodeNavSearchText,
    normalizedNodeNavSearchText,
    nodeNavFailedOnly,
    nodeNavMode,
    setNodeNavMode,
    toggleNodeNavFailedOnly,
    nodeNavItems,
    nodeNavEmptyDescription,
    formatNodeNavMatchHint,
    formatNodeNavMatchPreview,
  }
}
