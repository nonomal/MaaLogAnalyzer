import { wrapRaw } from '../shared/rawValue'
import type { NodeInfo } from '../shared/types'
import { readNumberField } from '../shared/logEventDecoders'
import { resolveEventFocus } from '../node/eventValueHelpers'
import { resetTaskNodeAggregation, type TaskScopedNodeAggregation } from '../task/scopedAggregationHelpers'

type WithTimestamps = (
  actionDetails: any,
  startTimestamp?: string,
  endTimestamp?: string,
  fallbackEndTimestamp?: string
) => NodeInfo['action_details']

export const startCurrentPipelineNodeEvent = (params: {
  details: Record<string, any>
  timestamp: string
  rootTaskId: number
  nodes: NodeInfo[]
  pipelineNodesById: Map<number, NodeInfo>
  resetCurrentNodeAggregation: () => void
  withTimestamps: WithTimestamps
  intern: (value: string) => string
}): number | null => {
  const nodeId = readNumberField(params.details, 'node_id')
  if (nodeId == null) return null
  const startTimestamp = params.intern(params.timestamp)
  params.resetCurrentNodeAggregation()

  let activeNode = params.pipelineNodesById.get(nodeId)
  if (!activeNode) {
    activeNode = {
      node_id: nodeId,
      name: params.intern(params.details.name || ''),
      ts: startTimestamp,
      end_ts: startTimestamp,
      status: 'running',
      task_id: params.rootTaskId,
      reco_details: params.details.reco_details ? wrapRaw(params.details.reco_details) : undefined,
      action_details: params.withTimestamps(params.details.action_details, undefined, undefined, startTimestamp),
      focus: resolveEventFocus(params.details),
      next_list: [],
      node_details: params.details.node_details ? wrapRaw(params.details.node_details) : undefined,
    }
    params.nodes.push(activeNode)
    params.pipelineNodesById.set(nodeId, activeNode)
  } else if (activeNode.status === 'running') {
    activeNode.name = params.intern(params.details.name || activeNode.name || '')
    activeNode.ts = startTimestamp
    activeNode.end_ts = startTimestamp
    activeNode.task_id = params.rootTaskId
    activeNode.focus = resolveEventFocus(params.details, activeNode.focus)
  }

  return nodeId
}

export const startSubTaskPipelineNodeEvent = (params: {
  subTaskId: number | null
  details: Record<string, any>
  timestamp: string
  scopedKey: (taskId: number, nodeId: number) => string
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
  subTaskPipelineNodeStartTimes: Map<string, string>
  intern: (value: string) => string
}): void => {
  if (params.subTaskId == null) return

  resetTaskNodeAggregation(params.taskScopedNodeAggregationByTaskId, params.subTaskId)
  const nodeId = readNumberField(params.details, 'node_id')
  if (nodeId != null) {
    params.subTaskPipelineNodeStartTimes.set(
      params.scopedKey(params.subTaskId, nodeId),
      params.intern(params.timestamp)
    )
  }
}