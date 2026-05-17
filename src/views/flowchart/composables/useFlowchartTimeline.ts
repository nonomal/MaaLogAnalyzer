import { computed, nextTick, ref, type Ref } from 'vue'
import type { NodeInfo, TaskInfo } from '../../../types'
import {
  buildNodeExecutionTimeline,
  type NodeExecutionNavStatus,
} from '@windsland52/maa-log-tools/node-execution-timeline'

interface UseFlowchartTimelineOptions {
  selectedTask: Ref<TaskInfo | null>
}

interface TimelineItem {
  index: number
  name: string
  status: NodeInfo['status']
  ts: string
  nodeInfo: NodeInfo
  focusNodeId: string
}

export type FlowchartTimelineNavStatus = NodeExecutionNavStatus

interface TimelineNavItem {
  index: number
  name: string
  status: FlowchartTimelineNavStatus
  focusNodeId: string
  ts: string
  nodeInfo: NodeInfo
}

export const useFlowchartTimeline = (options: UseFlowchartTimelineOptions) => {
  const selectedTimelineIndex = ref<number | null>(null)
  const showNavDrawer = ref(false)

  const timelineItems = computed(() => {
    const task = options.selectedTask.value
    if (!task) return []
    return buildNodeExecutionTimeline(task.nodes)
  })

  // Execution timeline: one entry per execution in order.
  const executionTimeline = computed<TimelineItem[]>(() => {
    return timelineItems.value.map((item) => ({
      index: item.index,
      name: item.executionName,
      status: item.nodeInfo.status,
      ts: item.ts,
      nodeInfo: item.nodeInfo,
      focusNodeId: item.focusNodeId,
    }))
  })

  const timelineNavItems = computed<TimelineNavItem[]>(() => {
    return timelineItems.value.map((item) => {
      return {
        index: item.index,
        name: item.navName,
        status: item.navStatus,
        focusNodeId: item.focusNodeId,
        ts: item.ts,
        nodeInfo: item.nodeInfo,
      }
    })
  })

  const getTimelineDotClass = (status: FlowchartTimelineNavStatus) => {
    if (status === 'timeout') return 'dot-timeout'
    if (status === 'action-failed') return 'dot-action-failed'
    if (status === 'success') return 'dot-success'
    if (status === 'running') return 'dot-running'
    return 'dot-failed'
  }

  // The canvas node ID that corresponds to the selected timeline item.
  const selectedFlowNodeId = computed(() => {
    if (selectedTimelineIndex.value == null) return null
    const item = timelineNavItems.value[selectedTimelineIndex.value]
    return item?.focusNodeId ?? null
  })

  const scrollNavToIndex = (index: number) => {
    nextTick(() => {
      const element = document.querySelector(`[data-nav-index="${index}"]`)
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  return {
    selectedTimelineIndex,
    showNavDrawer,
    executionTimeline,
    timelineNavItems,
    getTimelineDotClass,
    selectedFlowNodeId,
    scrollNavToIndex,
  }
}
