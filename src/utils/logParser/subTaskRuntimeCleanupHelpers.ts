import type { NestedActionNode, RecognitionAttempt } from '../../types'
import type { SubTaskActionSnapshot } from './subTaskCollector'
import { clearTaskNodeAggregation, type TaskScopedNodeAggregation } from './taskScopedAggregationHelpers'

type SubTaskActionCollector = {
  consumeActions: (subTaskId: number) => SubTaskActionSnapshot[]
  addAction: (subTaskId: number, action: SubTaskActionSnapshot) => void
}

export const consumeMatchedSubTaskAction = (
  subTasks: SubTaskActionCollector,
  subTaskId: number,
  actionId: number | null | undefined
): SubTaskActionSnapshot | undefined => {
  const taskActions = subTasks.consumeActions(subTaskId)
  if (taskActions.length === 0) return undefined

  let matchedTaskAction: SubTaskActionSnapshot | undefined
  let matchedTaskActionIndex = -1
  if (actionId != null) {
    for (let i = taskActions.length - 1; i >= 0; i--) {
      if (taskActions[i]?.action_id === actionId) {
        matchedTaskAction = taskActions[i]
        matchedTaskActionIndex = i
        break
      }
    }
  }
  if (!matchedTaskAction) {
    matchedTaskActionIndex = taskActions.length - 1
    matchedTaskAction = taskActions[matchedTaskActionIndex]
  }
  for (let i = 0; i < taskActions.length; i++) {
    if (i === matchedTaskActionIndex) continue
    subTasks.addAction(subTaskId, taskActions[i])
  }
  return matchedTaskAction
}

export const clearSubTaskRuntimeStateAfterPipelineFinalize = (params: {
  subTaskId: number
  nodeId: number | null | undefined
  actionKey: string | null
  scopedKey: (taskId: number, nodeId: number) => string
  subTaskPipelineNodeStartTimes: Map<string, string>
  subTaskActionStartTimes: Map<string, string>
  subTaskActionEndTimes: Map<string, string>
  subTaskActionStartOrders: Map<string, number>
  subTaskActionEndOrders: Map<string, number>
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  activeRecognitionNodeAttempts: Map<string, RecognitionAttempt>
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
}): void => {
  if (params.nodeId != null) {
    params.subTaskPipelineNodeStartTimes.delete(params.scopedKey(params.subTaskId, params.nodeId))
  }
  if (params.actionKey) {
    params.subTaskActionStartTimes.delete(params.actionKey)
    params.subTaskActionEndTimes.delete(params.actionKey)
    params.subTaskActionStartOrders.delete(params.actionKey)
    params.subTaskActionEndOrders.delete(params.actionKey)
  }
  const scopedPrefix = `${params.subTaskId}:`
  for (const key of params.activeSubTaskActionNodes.keys()) {
    if (key.startsWith(scopedPrefix)) {
      params.activeSubTaskActionNodes.delete(key)
    }
  }
  for (const key of params.activeRecognitionNodeAttempts.keys()) {
    if (key.startsWith(scopedPrefix)) {
      params.activeRecognitionNodeAttempts.delete(key)
    }
  }
  clearTaskNodeAggregation(params.taskScopedNodeAggregationByTaskId, params.subTaskId)
}
