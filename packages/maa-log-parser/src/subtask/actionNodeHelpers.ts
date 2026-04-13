import type { NestedActionGroup, NestedActionNode, NodeInfo } from '../shared/types'
import {
  resolveActionNodeEventId,
  resolveSubTaskActionKey,
} from '../action/helpers'
import { summarizeRuntimeStatus } from './collector'

export const createActionNodeGroup = (params: {
  taskId: number
  ts: string
  endTs?: string
  nestedActions: NestedActionNode[]
  intern: (value: string) => string
}): NestedActionGroup | null => {
  if (params.nestedActions.length === 0) return null
  return {
    task_id: params.taskId,
    name: params.intern('ActionNode'),
    ts: params.ts,
    end_ts: params.endTs,
    status: summarizeRuntimeStatus(params.nestedActions),
    nested_actions: params.nestedActions,
  }
}

type StartSubTaskActionNodeParams = {
  subTaskId: number
  details: Record<string, any>
  timestamp: string
  nestedActionNodes: NestedActionNode[]
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  subTaskActionNodeStartTimes: Map<string, string>
  withTimestamps: (
    actionDetails: any,
    startTimestamp?: string,
    endTimestamp?: string,
    fallbackEndTimestamp?: string
  ) => NodeInfo['action_details']
  intern: (value: string) => string
}

export const startSubTaskActionNode = (params: StartSubTaskActionNodeParams): void => {
  const actionId = resolveActionNodeEventId(params.details)
  if (actionId == null) return
  const actionKey = resolveSubTaskActionKey(params.subTaskId, actionId)
  if (!actionKey) return

  const startTimestamp = params.intern(params.timestamp)
  params.subTaskActionNodeStartTimes.set(actionKey, startTimestamp)
  if (!params.activeSubTaskActionNodes.has(actionKey)) {
    params.activeSubTaskActionNodes.set(actionKey, {
      node_id: typeof actionId === 'number'
        ? actionId
        : -(params.nestedActionNodes.length + params.activeSubTaskActionNodes.size + 1),
      name: params.intern(params.details.name || ''),
      ts: startTimestamp,
      end_ts: startTimestamp,
      status: 'running',
      action_details: params.withTimestamps(params.details.action_details, startTimestamp, undefined, startTimestamp),
    })
  }
}

type FinishSubTaskActionNodeParams = {
  subTaskId: number
  details: Record<string, any>
  timestamp: string
  status: 'success' | 'failed'
  nestedActionNodes: NestedActionNode[]
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  subTaskActionNodeStartTimes: Map<string, string>
  subTaskActionStartTimes: Map<string, string>
  subTaskActionEndTimes: Map<string, string>
  withTimestamps: (
    actionDetails: any,
    startTimestamp?: string,
    endTimestamp?: string,
    fallbackEndTimestamp?: string
  ) => NodeInfo['action_details']
  intern: (value: string) => string
}

export const finishSubTaskActionNode = (params: FinishSubTaskActionNodeParams): void => {
  const actionId = resolveActionNodeEventId(params.details)
  const actionKey = resolveSubTaskActionKey(params.subTaskId, actionId)
  const actionNodeStartTimestamp = actionKey ? params.subTaskActionNodeStartTimes.get(actionKey) : undefined
  const actionStartTimestamp = actionKey ? params.subTaskActionStartTimes.get(actionKey) : undefined
  const actionEndTimestamp = actionKey ? params.subTaskActionEndTimes.get(actionKey) : undefined
  const nowTimestamp = params.intern(params.timestamp)
  const runningActionNode = actionKey ? params.activeSubTaskActionNodes.get(actionKey) : undefined
  const resolvedActionNode: NestedActionNode = runningActionNode ?? {
    node_id: typeof actionId === 'number'
      ? actionId
      : -(params.nestedActionNodes.length + params.activeSubTaskActionNodes.size + 1),
    name: params.intern(params.details.name || ''),
    ts: actionNodeStartTimestamp || nowTimestamp,
    end_ts: actionEndTimestamp || nowTimestamp,
    status: 'running',
    action_details: undefined,
  }
  resolvedActionNode.name = params.intern(params.details.name || resolvedActionNode.name || '')
  resolvedActionNode.ts = resolvedActionNode.ts || actionNodeStartTimestamp || nowTimestamp
  resolvedActionNode.end_ts = actionEndTimestamp || nowTimestamp
  resolvedActionNode.status = params.status
  resolvedActionNode.action_details = params.withTimestamps(
    params.details.action_details,
    actionStartTimestamp || actionNodeStartTimestamp || resolvedActionNode.ts,
    actionEndTimestamp,
    params.timestamp
  )
  params.nestedActionNodes.push(resolvedActionNode)
  if (actionKey) {
    params.subTaskActionNodeStartTimes.delete(actionKey)
    params.activeSubTaskActionNodes.delete(actionKey)
  }
}
