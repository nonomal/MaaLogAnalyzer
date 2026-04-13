import type { NestedActionNode, NodeInfo, RecognitionAttempt } from '../shared/types'
import type { ActionRuntimeState } from '../action/runtimeHelpers'
import type { SubTaskSnapshot } from '../subtask/snapshotHelpers'
import type { TaskScopedNodeAggregation } from './scopedAggregationHelpers'
import { createTaskStackTracker } from './stackHelpers'

export const createTaskNodeRuntimeContext = (rootTaskId: number) => {
  return {
    nodes: [] as NodeInfo[],
    pipelineNodesById: new Map<number, NodeInfo>(),
    taskScopedNodeAggregationByTaskId: new Map<number, TaskScopedNodeAggregation>(),
    currentTaskRecognitions: [] as RecognitionAttempt[],
    actionLevelRecognitionNodes: [] as RecognitionAttempt[],
    nestedActionNodes: [] as NestedActionNode[],
    pipelineNodeStartTimes: new Map<number, string>(),
    recognitionNodeStartTimes: new Map<number, string>(),
    activeRecognitionNodeAttempts: new Map<string, RecognitionAttempt>(),
    actionStartTimes: new Map<number, string>(),
    actionEndTimes: new Map<number, string>(),
    actionStartOrders: new Map<number, number>(),
    actionEndOrders: new Map<number, number>(),
    actionNodeStartTimes: new Map<number, string>(),
    actionRuntimeStates: new Map<number, ActionRuntimeState>(),
    activeSubTaskActionNodes: new Map<string, NestedActionNode>(),
    subTaskPipelineNodeStartTimes: new Map<string, string>(),
    subTaskRecognitionNodeStartTimes: new Map<string, string>(),
    subTaskActionStartTimes: new Map<string, string>(),
    subTaskActionEndTimes: new Map<string, string>(),
    subTaskActionStartOrders: new Map<string, number>(),
    subTaskActionEndOrders: new Map<string, number>(),
    subTaskActionNodeStartTimes: new Map<string, string>(),
    subTaskSnapshots: new Map<number, SubTaskSnapshot>(),
    subTaskParentByTaskId: new Map<number, number>(),
    taskStackTracker: createTaskStackTracker(rootTaskId),
    activeRecognitionAttempts: new Map<string, RecognitionAttempt>(),
    activeRecognitionStack: [] as Array<{ taskId: number; recoId: number }>,
    finishedRecognitionKeys: new Set<string>(),
    recognitionOrderMeta: new WeakMap<RecognitionAttempt, { startSeq: number; endSeq: number }>(),
  }
}
