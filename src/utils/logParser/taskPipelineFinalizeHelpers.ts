import { markRaw } from 'vue'
import type { NestedActionGroup, NodeInfo, RecognitionAttempt } from '../../types'
import type { TaskTerminalPhase } from './eventMeta'
import type { SubTaskCollector } from './subTaskCollector'
import type { TaskScopedNodeAggregation } from './taskScopedAggregationHelpers'

export const finalizeTaskPipelineNodeEvent = (params: {
  taskId: number
  details: Record<string, any>
  phase: TaskTerminalPhase
  timestamp: string
  readNumberField: (details: Record<string, any>, field: string) => number | undefined
  resolveTerminalCompletionStatus: (phase: TaskTerminalPhase) => 'success' | 'failed'
  settleCurrentNodeRuntimeStates: (fallbackStatus: 'success' | 'failed', timestamp: string) => void
  pipelineNodeStartTimes: Map<number, string>
  resolveActionDetailsActionId: (details: Record<string, any>) => number | null | undefined
  actionStartTimes: Map<number, string>
  actionEndTimes: Map<number, string>
  actionStartOrders: Map<number, number>
  actionEndOrders: Map<number, number>
  currentTaskRecognitions: RecognitionAttempt[]
  actionLevelRecognitionNodes: RecognitionAttempt[]
  dedupeRecognitionAttempts: (items: RecognitionAttempt[]) => RecognitionAttempt[]
  splitRecognitionAttemptsByActionWindow: (
    attempts: RecognitionAttempt[],
    recognitionOrderMeta: WeakMap<RecognitionAttempt, { startSeq: number; endSeq: number }>,
    actionStartOrder?: number,
    actionEndOrder?: number
  ) => { topLevel: RecognitionAttempt[]; actionLevel: RecognitionAttempt[] }
  recognitionOrderMeta: WeakMap<RecognitionAttempt, { startSeq: number; endSeq: number }>
  subTasks: SubTaskCollector
  consumeSubTaskActionGroups: () => NestedActionGroup[]
  subTaskSnapshots: Map<number, any>
  mergeSubTaskActionGroupWithSnapshot: (
    group: NestedActionGroup,
    snapshot: any,
    intern: (value: string) => string
  ) => NestedActionGroup
  attachActionLevelRecognitionAcrossScopes: (params: {
    topLevelAttempts: RecognitionAttempt[]
    nestedActionGroups: NestedActionGroup[]
    actionLevelNodes: RecognitionAttempt[]
    actionStartOrder?: number
    recognitionOrderMeta: WeakMap<RecognitionAttempt, { startSeq: number; endSeq: number }>
    cloneRecognitionAttempt: (attempt: RecognitionAttempt) => RecognitionAttempt
    sortByParseOrderThenRecoId: (attempts: RecognitionAttempt[]) => RecognitionAttempt[]
    pickBestAttemptIndex: (attempts: RecognitionAttempt[], node: RecognitionAttempt) => number
    attachNodeToAttempt: (parent: RecognitionAttempt, child: RecognitionAttempt) => void
    dedupeRecognitionAttempts: (items: RecognitionAttempt[]) => RecognitionAttempt[]
  }) => {
    topLevelAttempts: RecognitionAttempt[]
    nestedActionGroups: NestedActionGroup[]
    remaining: RecognitionAttempt[]
  }
  cloneRecognitionAttempt: (attempt: RecognitionAttempt) => RecognitionAttempt
  sortByParseOrderThenRecoId: (attempts: RecognitionAttempt[]) => RecognitionAttempt[]
  pickBestAttemptIndex: (attempts: RecognitionAttempt[], node: RecognitionAttempt) => number
  attachNodeToAttempt: (parent: RecognitionAttempt, child: RecognitionAttempt) => void
  resolveFinalNestedActionGroups: (
    taskId: number,
    startTimestamp: string,
    endTimestamp: string,
    groups: NestedActionGroup[]
  ) => NestedActionGroup[]
  resolveFallbackRecoDetails: (details: Record<string, any>, attempts: RecognitionAttempt[]) => any
  withTimestamps: (
    actionDetails: any,
    startTimestamp?: string,
    endTimestamp?: string,
    fallbackEndTimestamp?: string
  ) => NodeInfo['action_details']
  composeFinalPipelineNodeFlow: (params: {
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
  }) => { nodeFlow: any[]; actionFlow: any[] }
  findErrorImageByNames: (timestamp: string, candidateNames: Array<string | null | undefined>) => string | undefined
  getTaskNextList: (map: Map<number, TaskScopedNodeAggregation>, taskId: number) => any[]
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
  pipelineNodesById: Map<number, NodeInfo>
  resolveEventFocus: (details: Record<string, any>, fallbackFocus?: NodeInfo['focus']) => NodeInfo['focus']
  upsertCurrentTaskPipelineNode: (node: NodeInfo) => NodeInfo
  cleanupCurrentTaskPipelineRuntimeState: (nodeId: number, actionId: number | null | undefined) => void
  intern: (value: string) => string
}): void => {
  const nodeId = params.readNumberField(params.details, 'node_id')
  if (!nodeId) return

  const pipelineStatus = params.resolveTerminalCompletionStatus(params.phase)
  params.settleCurrentNodeRuntimeStates(pipelineStatus, params.timestamp)

  const nodeName = params.details.name || ''
  const startTimestamp = params.pipelineNodeStartTimes.get(nodeId) || params.intern(params.timestamp)
  const endTimestamp = params.intern(params.timestamp)
  const actionId = params.resolveActionDetailsActionId(params.details)
  const actionStartTimestamp = actionId != null ? params.actionStartTimes.get(actionId) : undefined
  const actionEndTimestamp = actionId != null ? params.actionEndTimes.get(actionId) : undefined
  const actionStartOrder = actionId != null ? params.actionStartOrders.get(actionId) : undefined
  const actionEndOrder = actionId != null ? params.actionEndOrders.get(actionId) : undefined
  const currentTaskRecognitionAttempts = params.dedupeRecognitionAttempts(params.currentTaskRecognitions)
  const { topLevel: scopedTopLevelRecognitions, actionLevel: scopedActionRecognitions } =
    params.splitRecognitionAttemptsByActionWindow(
      currentTaskRecognitionAttempts,
      params.recognitionOrderMeta,
      actionStartOrder,
      actionEndOrder
    )
  const subTaskActionGroups: NestedActionGroup[] =
    params.consumeSubTaskActionGroups().map((group) => {
      const snapshot = params.subTaskSnapshots.get(group.task_id)
      return snapshot
        ? params.mergeSubTaskActionGroupWithSnapshot(group, snapshot, params.intern)
        : group
    })
  const subTaskOrphanRecognitionAttempts = params.subTasks.consumeOrphanRecognitions()
  const subTaskOrphanRecognitionNodes = params.subTasks.consumeOrphanRecognitionNodes()
  const pendingActionLevelRecognitions = params.dedupeRecognitionAttempts([
    ...params.actionLevelRecognitionNodes,
    ...scopedActionRecognitions,
    ...subTaskOrphanRecognitionAttempts,
    ...subTaskOrphanRecognitionNodes,
  ])
  const scopedAttachResult = params.attachActionLevelRecognitionAcrossScopes({
    topLevelAttempts: scopedTopLevelRecognitions,
    nestedActionGroups: subTaskActionGroups,
    actionLevelNodes: pendingActionLevelRecognitions,
    actionStartOrder,
    recognitionOrderMeta: params.recognitionOrderMeta,
    cloneRecognitionAttempt: params.cloneRecognitionAttempt,
    sortByParseOrderThenRecoId: params.sortByParseOrderThenRecoId,
    pickBestAttemptIndex: params.pickBestAttemptIndex,
    attachNodeToAttempt: params.attachNodeToAttempt,
    dedupeRecognitionAttempts: params.dedupeRecognitionAttempts,
  })
  const nestedRecognitionInAction = scopedAttachResult.remaining
  const resolvedNestedActionGroups = params.resolveFinalNestedActionGroups(
    params.taskId,
    startTimestamp,
    endTimestamp,
    scopedAttachResult.nestedActionGroups
  )
  const fallbackRecoDetails = params.resolveFallbackRecoDetails(params.details, scopedAttachResult.topLevelAttempts)
  const mergedActionDetails = params.withTimestamps(params.details.action_details, actionStartTimestamp, actionEndTimestamp, endTimestamp)
  const resolvedNodeName = params.intern(nodeName)
  const composedFlow = params.composeFinalPipelineNodeFlow({
    taskScopedNodeAggregationByTaskId: params.taskScopedNodeAggregationByTaskId,
    taskId: params.taskId,
    topLevelRecognitions: scopedAttachResult.topLevelAttempts,
    actionLevelRecognitions: nestedRecognitionInAction,
    nestedActionGroups: resolvedNestedActionGroups,
    actionDetails: mergedActionDetails,
    fallbackStatus: pipelineStatus,
    eventTimestamp: params.timestamp,
    details: params.details,
    nodeName: resolvedNodeName,
    actionId,
    nodeId,
    fallbackTimestamp: endTimestamp,
    findErrorImageByNames: params.findErrorImageByNames,
  })
  const nodeFlow = composedFlow.nodeFlow
  const actionFlow = composedFlow.actionFlow

  const resolvedNextList = params.getTaskNextList(params.taskScopedNodeAggregationByTaskId, params.taskId)
  let nodeStatus: NodeInfo['status'] = pipelineStatus
  if (nodeStatus === 'success' && actionFlow.some(item => item.type === 'task' && item.status === 'failed')) {
    nodeStatus = 'failed'
  }

  const resolvedRecoDetails = fallbackRecoDetails ? markRaw(fallbackRecoDetails) : undefined
  const existingNode = params.pipelineNodesById.get(nodeId)
  const resolvedFocus = params.resolveEventFocus(params.details, existingNode?.focus)
  const resolvedNodeDetails = params.details.node_details ? markRaw(params.details.node_details) : undefined
  const resolvedNodeFlow = nodeFlow.length > 0 ? nodeFlow : undefined
  const resolvedErrorImage = params.findErrorImageByNames(params.timestamp, [
    params.details.action_details?.name,
    params.details.node_details?.name,
    params.details.reco_details?.name,
    nodeName,
  ])
  const resolvedNode: NodeInfo = {
    node_id: nodeId,
    task_id: params.taskId,
    name: resolvedNodeName,
    ts: startTimestamp,
    end_ts: endTimestamp,
    status: nodeStatus,
    reco_details: resolvedRecoDetails,
    action_details: mergedActionDetails,
    focus: resolvedFocus,
    next_list: resolvedNextList,
    node_flow: resolvedNodeFlow,
    node_details: resolvedNodeDetails,
    error_image: resolvedErrorImage,
  }
  params.upsertCurrentTaskPipelineNode(resolvedNode)
  params.cleanupCurrentTaskPipelineRuntimeState(nodeId, actionId)
}
