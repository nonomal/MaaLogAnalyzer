import type { NestedActionNode, RecognitionAttempt } from '../shared/types'
import type { ActionRuntimeState } from '../action/runtimeHelpers'
import type { SubTaskCollector } from '../subtask/collector'
import { resetTaskNodeAggregation, type TaskScopedNodeAggregation } from '../task/scopedAggregationHelpers'

export const resetCurrentNodeAggregationState = (params: {
  rootTaskId: number
  taskScopedNodeAggregationByTaskId: Map<number, TaskScopedNodeAggregation>
  currentTaskRecognitions: RecognitionAttempt[]
  nestedActionNodes: NestedActionNode[]
  actionLevelRecognitionNodes: RecognitionAttempt[]
  activeRecognitionNodeAttempts: Map<string, RecognitionAttempt>
  actionRuntimeStates: Map<number, ActionRuntimeState>
  activeSubTaskActionNodes: Map<string, NestedActionNode>
  subTasks: SubTaskCollector
  subTaskParentByTaskId: Map<number, number>
  taskStackTracker: { reset: () => void }
}): void => {
  params.taskScopedNodeAggregationByTaskId.clear()
  resetTaskNodeAggregation(params.taskScopedNodeAggregationByTaskId, params.rootTaskId)
  params.currentTaskRecognitions.length = 0
  params.nestedActionNodes.length = 0
  params.actionLevelRecognitionNodes.length = 0
  params.activeRecognitionNodeAttempts.clear()
  params.actionRuntimeStates.clear()
  params.activeSubTaskActionNodes.clear()
  params.subTasks.clear()
  params.subTaskParentByTaskId.clear()
  params.taskStackTracker.reset()
}
