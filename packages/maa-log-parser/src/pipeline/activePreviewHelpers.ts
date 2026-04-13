import { wrapRaw } from '../shared/rawValue'
import type {
  NestedActionGroup,
  NestedActionNode,
  NodeInfo,
  RecognitionAttempt,
  UnifiedFlowItem,
} from '../shared/types'
import { dedupeNestedActionNodes, getLatestActionRuntimeState, type ActionRuntimeState } from '../action/runtimeHelpers'
import { nestSubTaskActionGroups } from '../subtask/nestingHelpers'

export const resolveFinalNestedActionGroups = (params: {
  taskId: number
  rootTaskId: number
  startTimestamp: string
  endTimestamp: string
  groups: NestedActionGroup[]
  subTaskParentByTaskId: Map<number, number>
  nestedActionNodes: NestedActionNode[]
  createActionNodeGroup: (params: {
    taskId: number
    ts: string
    endTs?: string
    nestedActions: NestedActionNode[]
    intern: (value: string) => string
  }) => NestedActionGroup | null
  cloneNestedActionGroup: (group: NestedActionGroup, cloneRecognitionAttempt: (attempt: RecognitionAttempt) => RecognitionAttempt) => NestedActionGroup
  cloneRecognitionAttempt: (attempt: RecognitionAttempt) => RecognitionAttempt
  toTimestampMs: (value?: string) => number
  intern: (value: string) => string
}): NestedActionGroup[] => {
  const nestedSubTaskGroups = nestSubTaskActionGroups({
    groups: params.groups,
    rootTaskId: params.rootTaskId,
    subTaskParentByTaskId: params.subTaskParentByTaskId,
    toTimestampMs: params.toTimestampMs,
    cloneGroup: (group) => params.cloneNestedActionGroup(group, params.cloneRecognitionAttempt),
  })
  if (nestedSubTaskGroups.length > 0) {
    return nestedSubTaskGroups
  }
  const fallbackActionGroup = params.createActionNodeGroup({
    taskId: params.taskId,
    ts: params.startTimestamp,
    endTs: params.endTimestamp,
    nestedActions: params.nestedActionNodes.slice(),
    intern: params.intern,
  })
  return fallbackActionGroup ? [fallbackActionGroup] : []
}

export const refreshActivePipelineNodePreview = (params: {
  timestamp: string
  rootTaskId: number
  getActivePipelineNode: () => NodeInfo | null
  getTaskNextList: () => NodeInfo['next_list']
  currentTaskRecognitions: RecognitionAttempt[]
  actionLevelRecognitionNodes: RecognitionAttempt[]
  nestedActionNodes: NestedActionNode[]
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  collectSubTaskActionGroups: () => NestedActionGroup[]
  resolveRuntimeNestedActionGroups: (params: {
    taskId: number
    startTimestamp: string
    endTimestamp: string
    groups: NestedActionGroup[]
    nestedActionNodes: NestedActionNode[]
  }) => NestedActionGroup[]
  actionRuntimeStates: Map<number, ActionRuntimeState>
  composePipelineNodeFlow: (params: {
    topLevelRecognitions: RecognitionAttempt[]
    actionLevelRecognitions: RecognitionAttempt[]
    nestedActionGroups: NestedActionGroup[]
    waitFreezesFlow: UnifiedFlowItem[]
    createActionRoot: (actionFlow: UnifiedFlowItem[]) => UnifiedFlowItem | null
  }) => { nodeFlow: UnifiedFlowItem[] }
  summarizeActionFlowStatus: (items: UnifiedFlowItem[]) => 'success' | 'failed' | 'running' | null
  createActionRootFlowItem: (params: {
    actionId: number
    name: string
    status: UnifiedFlowItem['status']
    ts: string
    endTs?: string
    actionDetails?: NodeInfo['action_details']
    errorImage?: string
  }) => UnifiedFlowItem
  buildWaitFreezesFlowItems: () => UnifiedFlowItem[]
  findErrorImageByNames: (timestamp: string, names: Array<string | null | undefined>) => string | undefined
  intern: (value: string) => string
  dedupeRecognitionAttempts: (items: RecognitionAttempt[]) => RecognitionAttempt[]
}): void => {
  const activeNode = params.getActivePipelineNode()
  if (!activeNode) return

  const nowTimestamp = params.intern(params.timestamp)
  activeNode.end_ts = nowTimestamp
  activeNode.next_list = params.getTaskNextList()

  const topLevelRecognitions = params.dedupeRecognitionAttempts(params.currentTaskRecognitions)
  const actionRecognitions = params.dedupeRecognitionAttempts(params.actionLevelRecognitionNodes)
  const runtimeNestedActionNodes = dedupeNestedActionNodes([
    ...params.nestedActionNodes,
    ...params.activeSubTaskActionNodes.values(),
  ])
  const runtimeNestedActionGroups = params.resolveRuntimeNestedActionGroups({
    taskId: params.rootTaskId,
    startTimestamp: activeNode.ts,
    endTimestamp: nowTimestamp,
    groups: params.collectSubTaskActionGroups(),
    nestedActionNodes: runtimeNestedActionNodes,
  })

  const runtimeActionState = getLatestActionRuntimeState(params.actionRuntimeStates)
  const resolvedActionId =
    runtimeActionState?.action_id ??
    activeNode.action_details?.action_id ??
    activeNode.node_details?.action_id ??
    activeNode.node_id

  const composedFlow = params.composePipelineNodeFlow({
    topLevelRecognitions,
    actionLevelRecognitions: actionRecognitions,
    nestedActionGroups: runtimeNestedActionGroups,
    waitFreezesFlow: params.buildWaitFreezesFlowItems(),
    createActionRoot: (actionFlow) => {
      const inferredActionStatus = params.summarizeActionFlowStatus(actionFlow)
      const actionRootStatus = runtimeActionState?.status ?? inferredActionStatus
      if (!actionRootStatus) return null

      const runtimeActionErrorImage = actionRootStatus === 'failed'
        ? params.findErrorImageByNames(nowTimestamp, [
            runtimeActionState?.name,
            activeNode.action_details?.name,
            activeNode.node_details?.name,
            activeNode.reco_details?.name,
            activeNode.name,
          ])
        : undefined

      return params.createActionRootFlowItem({
        actionId: resolvedActionId,
        name:
          runtimeActionState?.name ||
          activeNode.action_details?.name ||
          activeNode.name,
        status: actionRootStatus,
        ts: runtimeActionState?.ts || activeNode.action_details?.ts || activeNode.ts,
        endTs: runtimeActionState?.end_ts || activeNode.action_details?.end_ts || nowTimestamp,
        actionDetails: activeNode.action_details,
        errorImage: runtimeActionErrorImage,
      })
    },
  })

  activeNode.node_flow = composedFlow.nodeFlow
  const fallbackRecoDetails =
    topLevelRecognitions.length > 0
      ? topLevelRecognitions[topLevelRecognitions.length - 1].reco_details
      : undefined
  if (fallbackRecoDetails) {
    activeNode.reco_details = wrapRaw(fallbackRecoDetails)
  }
}