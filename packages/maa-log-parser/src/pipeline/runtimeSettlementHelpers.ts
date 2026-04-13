import type { NestedActionNode, RecognitionAttempt } from '../shared/types'
import type { ActionRuntimeState } from '../action/runtimeHelpers'
import type { TaskScopedNodeAggregation } from '../task/scopedAggregationHelpers'

type SettleCurrentNodeRuntimeStatesParams = {
  fallbackStatus: 'success' | 'failed'
  timestamp: string
  taskId: number
  currentTaskRecognitions: RecognitionAttempt[]
  actionLevelRecognitionNodes: RecognitionAttempt[]
  activeRecognitionAttempts: Map<string, RecognitionAttempt>
  activeRecognitionNodeAttempts: Map<string, RecognitionAttempt>
  activeRecognitionStack: Array<{ taskId: number; recoId: number }>
  finishedRecognitionKeys: Set<string>
  actionRuntimeStates: Map<number, ActionRuntimeState>
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  nestedActionNodes: NestedActionNode[]
  intern: (value: string) => string
}

export const settleCurrentNodeRuntimeStates = (params: SettleCurrentNodeRuntimeStatesParams): void => {
  const endTimestamp = params.intern(params.timestamp)
  const settleAttempt = (attempt: RecognitionAttempt) => {
    if (attempt.status !== 'running') return
    attempt.status = params.fallbackStatus
    attempt.end_ts = endTimestamp
  }

  for (const attempt of params.currentTaskRecognitions) {
    settleAttempt(attempt)
  }
  for (const attempt of params.actionLevelRecognitionNodes) {
    settleAttempt(attempt)
  }

  const currentTaskKeyPrefix = `${params.taskId}:`
  for (const [key, attempt] of params.activeRecognitionAttempts.entries()) {
    if (!key.startsWith(currentTaskKeyPrefix)) continue
    settleAttempt(attempt)
    params.activeRecognitionAttempts.delete(key)
    params.finishedRecognitionKeys.add(key)
  }
  for (const key of params.activeRecognitionNodeAttempts.keys()) {
    if (!key.startsWith(currentTaskKeyPrefix)) continue
    const attempt = params.activeRecognitionNodeAttempts.get(key)
    if (attempt) settleAttempt(attempt)
  }
  for (let i = params.activeRecognitionStack.length - 1; i >= 0; i--) {
    if (params.activeRecognitionStack[i].taskId === params.taskId) {
      params.activeRecognitionStack.splice(i, 1)
    }
  }

  for (const state of params.actionRuntimeStates.values()) {
    if (state.status !== 'running') continue
    state.status = params.fallbackStatus
    state.end_ts = endTimestamp
  }
  for (const aggregation of params.taskScopedNodeAggregationByTaskId.values()) {
    for (const state of aggregation.waitFreezesRuntimeStates.values()) {
      if (state.status !== 'running') continue
      state.status = params.fallbackStatus
      state.end_ts = endTimestamp
    }
  }

  for (const actionNode of params.activeSubTaskActionNodes.values()) {
    if (actionNode.status === 'running') {
      actionNode.status = params.fallbackStatus
      actionNode.end_ts = endTimestamp
    }
    if (!params.nestedActionNodes.includes(actionNode)) {
      params.nestedActionNodes.push(actionNode)
    }
  }
}
