import type {
  NestedActionGroup,
  NodeInfo,
  RecognitionAttempt,
  UnifiedFlowItem,
} from '../shared/types'
import { buildActionFlowItems, buildRecognitionFlowItems } from '../node/flow'
import { toTimestampMs } from '../shared/timestamp'
import {
  partitionActionScopeWaitFreezes,
  sortFlowItemsByTimestamp,
  splitAndAttachWaitFreezesFlowItems,
} from './flowAssemblyHelpers'
import { summarizeRuntimeStatus } from '../subtask/collector'
import type { TaskScopedNodeAggregation } from '../task/scopedAggregationHelpers'
import { buildWaitFreezesFlowItems } from '../waitFreezes/helpers'

export const summarizeActionFlowStatus = (
  items: UnifiedFlowItem[]
): 'success' | 'failed' | 'running' | null => {
  if (items.length === 0) return null
  return summarizeRuntimeStatus(items)
}

export const createActionRootFlowItem = (params: {
  actionId: number
  name: string
  status: UnifiedFlowItem['status']
  ts: string
  endTs?: string
  actionDetails?: NodeInfo['action_details']
  errorImage?: string
}): UnifiedFlowItem => {
  return {
    id: `node.action.${params.actionId}`,
    type: 'action',
    name: params.name,
    status: params.status,
    ts: params.ts,
    end_ts: params.endTs,
    action_id: params.actionId,
    action_details: params.actionDetails,
    error_image: params.errorImage,
  }
}

export const createFinalActionRootFactory = (params: {
  actionDetails?: NodeInfo['action_details']
  fallbackStatus: 'success' | 'failed'
  eventTimestamp: string
  errorImageCandidates: Array<string | null | undefined>
  fallbackActionId: number | null | undefined
  fallbackName: string
  fallbackTimestamp: string
  findErrorImageByNames: (timestamp: string, candidateNames: Array<string | null | undefined>) => string | undefined
}) => {
  return (actionFlow: UnifiedFlowItem[]) => {
    const hasActionRoot = !!params.actionDetails || actionFlow.length > 0
    if (!hasActionRoot) return null

    const actionStatus: 'success' | 'failed' = params.actionDetails
      ? (params.actionDetails.success ? 'success' : 'failed')
      : params.fallbackStatus
    const resolvedActionErrorImage = actionStatus === 'failed'
      ? params.findErrorImageByNames(params.eventTimestamp, params.errorImageCandidates)
      : undefined
    const resolvedActionId = params.actionDetails?.action_id ?? params.fallbackActionId ?? -1
    return createActionRootFlowItem({
      actionId: resolvedActionId,
      name: params.actionDetails?.name || params.fallbackName,
      status: actionStatus,
      ts: params.actionDetails?.ts || params.actionDetails?.end_ts || params.fallbackTimestamp,
      endTs: params.actionDetails?.end_ts,
      actionDetails: params.actionDetails,
      errorImage: resolvedActionErrorImage,
    })
  }
}

const isRecognitionFlowItem = (item: UnifiedFlowItem): boolean => {
  return item.type === 'recognition' || item.type === 'recognition_node'
}

const collectRecognitionFlowItems = (
  items: UnifiedFlowItem[],
  target: UnifiedFlowItem[]
): void => {
  for (const item of items) {
    if (isRecognitionFlowItem(item)) {
      target.push(item)
    }
    if (item.children && item.children.length > 0) {
      collectRecognitionFlowItems(item.children, target)
    }
  }
}

const resolveFlowItemWindow = (
  item: UnifiedFlowItem
): { startMs: number; endMs: number } => {
  const startMs = toTimestampMs(item.ts || item.end_ts)
  const endMs = item.status === 'running'
    ? Number.POSITIVE_INFINITY
    : toTimestampMs(item.end_ts || item.ts)
  return { startMs, endMs }
}

const pickLatestUnfinishedRecognitionParent = (
  recognitionItems: UnifiedFlowItem[],
  taskItem: UnifiedFlowItem
): UnifiedFlowItem | null => {
  const taskStartMs = toTimestampMs(taskItem.ts || taskItem.end_ts)
  if (!Number.isFinite(taskStartMs)) return null

  let bestItem: UnifiedFlowItem | null = null
  let bestStartMs = Number.NEGATIVE_INFINITY

  for (const recognition of recognitionItems) {
    const { startMs, endMs } = resolveFlowItemWindow(recognition)
    const inRange =
      Number.isFinite(startMs) &&
      taskStartMs >= startMs &&
      (!Number.isFinite(endMs) || taskStartMs <= endMs + 1)
    if (!inRange) continue
    if (startMs > bestStartMs) {
      bestStartMs = startMs
      bestItem = recognition
    }
  }

  return bestItem
}

const reassignCustomActionTasksByActiveScope = (
  recognitionFlow: UnifiedFlowItem[],
  actionFlow: UnifiedFlowItem[]
): { recognitionFlow: UnifiedFlowItem[]; actionFlow: UnifiedFlowItem[] } => {
  if (actionFlow.length === 0) {
    return { recognitionFlow, actionFlow }
  }

  const recognitionCandidates: UnifiedFlowItem[] = []
  collectRecognitionFlowItems(recognitionFlow, recognitionCandidates)
  collectRecognitionFlowItems(actionFlow, recognitionCandidates)
  if (recognitionCandidates.length === 0) {
    return { recognitionFlow, actionFlow }
  }

  const retainedActionFlow: UnifiedFlowItem[] = []
  for (const item of actionFlow) {
    if (item.type !== 'task') {
      retainedActionFlow.push(item)
      continue
    }

    const recognitionParent = pickLatestUnfinishedRecognitionParent(recognitionCandidates, item)
    if (!recognitionParent) {
      retainedActionFlow.push(item)
      continue
    }

    recognitionParent.children = sortFlowItemsByTimestamp(
      [
        ...(recognitionParent.children ?? []),
        item,
      ],
      toTimestampMs
    )
  }

  return {
    recognitionFlow: sortFlowItemsByTimestamp(recognitionFlow, toTimestampMs),
    actionFlow: sortFlowItemsByTimestamp(retainedActionFlow, toTimestampMs),
  }
}

export const composePipelineNodeFlow = (params: {
  topLevelRecognitions: RecognitionAttempt[]
  actionLevelRecognitions: RecognitionAttempt[]
  nestedActionGroups: NestedActionGroup[]
  waitFreezesFlow: UnifiedFlowItem[]
  createActionRoot: (actionFlow: UnifiedFlowItem[]) => UnifiedFlowItem | null
}) => {
  const recognitionFlow = buildRecognitionFlowItems(params.topLevelRecognitions)
  const actionFlow = buildActionFlowItems(params.actionLevelRecognitions, params.nestedActionGroups)
  const {
    recognitionFlow: scopedRecognitionFlow,
    actionFlow: scopedActionFlow,
    actionScopeWaitFreezes,
    unassignedContextWaitFreezes,
  } = splitAndAttachWaitFreezesFlowItems({
    recognitionFlow,
    actionFlow,
    waitFreezesFlow: params.waitFreezesFlow,
    toTimestampMs,
  })
  const actionScopeWaitFreezesAll = [...actionScopeWaitFreezes, ...unassignedContextWaitFreezes]

  const actionRootBase = params.createActionRoot(actionFlow)
  const shouldReassignByScope = actionRootBase != null && (
    actionRootBase.action_details == null ||
    actionRootBase.action_details.action === 'Custom'
  )
  const {
    recognitionFlow: reassignedRecognitionFlow,
    actionFlow: reassignedActionFlow,
  } = shouldReassignByScope
    ? reassignCustomActionTasksByActiveScope(scopedRecognitionFlow, scopedActionFlow)
    : {
        recognitionFlow: scopedRecognitionFlow,
        actionFlow: scopedActionFlow,
      }
  const actionRoot: UnifiedFlowItem | null = actionRootBase
    ? {
        ...actionRootBase,
        children: reassignedActionFlow.length > 0
          ? sortFlowItemsByTimestamp(
            [
              ...(actionRootBase.children ?? []),
              ...reassignedActionFlow,
            ],
            toTimestampMs
          )
          : actionRootBase.children,
      }
    : null

  const waitFreezesPlacement = partitionActionScopeWaitFreezes(
    actionScopeWaitFreezesAll,
    toTimestampMs,
    actionRoot?.ts,
    actionRoot?.end_ts,
    actionRoot?.status,
  )
  if (actionRoot && waitFreezesPlacement.inside.length > 0) {
    actionRoot.children = sortFlowItemsByTimestamp(
      [
        ...(actionRoot.children ?? []),
        ...waitFreezesPlacement.inside,
      ],
      toTimestampMs
    )
  }

  const nodeFlow = [
    ...reassignedRecognitionFlow,
    ...waitFreezesPlacement.before,
    ...(!actionRoot ? waitFreezesPlacement.inside : []),
    ...(actionRoot ? [actionRoot] : []),
    ...waitFreezesPlacement.after,
  ]

  return {
    nodeFlow,
    actionFlow,
  }
}

export const composeFinalPipelineNodeFlow = (params: {
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
  taskId: number
  topLevelRecognitions: RecognitionAttempt[]
  actionLevelRecognitions: RecognitionAttempt[]
  nestedActionGroups: NestedActionGroup[]
  actionDetails?: NodeInfo['action_details']
  fallbackStatus: 'success' | 'failed'
  eventTimestamp: string
  details: Record<string, any>
  nodeName: string
  actionId: number | null | undefined
  nodeId: number | null | undefined
  fallbackTimestamp: string
  findErrorImageByNames: (timestamp: string, candidateNames: Array<string | null | undefined>) => string | undefined
}) => {
  return composePipelineNodeFlow({
    topLevelRecognitions: params.topLevelRecognitions,
    actionLevelRecognitions: params.actionLevelRecognitions,
    nestedActionGroups: params.nestedActionGroups,
    waitFreezesFlow: buildWaitFreezesFlowItems(
      params.taskScopedNodeAggregationByTaskId.get(params.taskId)?.waitFreezesRuntimeStates,
      params.taskId,
    ),
    createActionRoot: createFinalActionRootFactory({
      actionDetails: params.actionDetails,
      fallbackStatus: params.fallbackStatus,
      eventTimestamp: params.eventTimestamp,
      errorImageCandidates: [
        params.actionDetails?.name,
        params.details.action_details?.name,
        params.details.node_details?.name,
        params.details.reco_details?.name,
        params.nodeName,
      ],
      fallbackActionId: params.actionId ?? params.nodeId,
      fallbackName: params.nodeName,
      fallbackTimestamp: params.fallbackTimestamp,
      findErrorImageByNames: params.findErrorImageByNames,
    }),
  })
}