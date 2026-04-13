import type { RecognitionAttempt } from '../shared/types'
import type {
  KnownMaaPhase,
  MaaMessageMeta,
  TaskTerminalPhase,
} from '../event/meta'

export type ScopedSimpleNodeEventHandler = (
  taskId: number | null,
  messageMeta: MaaMessageMeta,
  phase: KnownMaaPhase,
  details: Record<string, any>,
  timestamp: string,
  eventOrder: number
) => boolean

export type ScopedActionEventHandler = (
  taskId: number | null,
  phase: KnownMaaPhase,
  details: Record<string, any>,
  timestamp: string,
  eventOrder: number
) => void

export type ScopedActionNodeEventHandler = (
  taskId: number | null,
  phase: KnownMaaPhase,
  details: Record<string, any>,
  timestamp: string
) => void

export type ScopedPipelineNodeStartingHandler = (
  taskId: number | null,
  details: Record<string, any>,
  timestamp: string
) => void

export type ScopedPipelineNodeFinalizeHandler = (
  taskId: number | null,
  details: Record<string, any>,
  phase: TaskTerminalPhase,
  timestamp: string
) => void

export type ScopedNodeDispatchConfig = {
  handleSimpleNodeEvent: ScopedSimpleNodeEventHandler
  dispatchPendingRecognition: (taskId: number, recognition: RecognitionAttempt) => void
  dispatchStandaloneRecognition: (taskId: number, recognition: RecognitionAttempt) => void
  handlePipelineNodeStarting: ScopedPipelineNodeStartingHandler
  handlePipelineNodeFinalize: ScopedPipelineNodeFinalizeHandler
  excludeTaskIdFromParentRecognitionLookup?: boolean
  dispatchDetachedRecognition?: (recognition: RecognitionAttempt) => void
}

type HandleSimpleNodeEvent = (
  taskId: number | null,
  messageMeta: MaaMessageMeta,
  phase: KnownMaaPhase,
  details: Record<string, any>,
  timestamp: string,
  eventOrder: number,
  handleActionEvent: ScopedActionEventHandler,
  handleActionNodeEvent: ScopedActionNodeEventHandler,
  onWaitFreezesUpdated?: (details: Record<string, any>) => void,
  onRecognitionAttempt?: (taskId: number, attempt: RecognitionAttempt) => void,
  skipRecognitionRefreshWhenTaskMissingOnFinish?: boolean
) => boolean

const resolveScopedTaskId = (
  fixedTaskId: number | undefined,
  taskId: number | null
): number | null => {
  return fixedTaskId ?? taskId
}

export const createScopedSimpleNodeEventHandler = (params: {
  fixedTaskId?: number
  handleActionEvent: ScopedActionEventHandler
  handleActionNodeEvent: ScopedActionNodeEventHandler
  onWaitFreezesUpdated?: (details: Record<string, any>) => void
  onRecognitionAttempt?: (taskId: number, attempt: RecognitionAttempt) => void
  skipRecognitionRefreshWhenTaskMissingOnFinish?: boolean
  handleSimpleNodeEvent: HandleSimpleNodeEvent
}): ScopedSimpleNodeEventHandler => {
  return (
    taskId: number | null,
    messageMeta: MaaMessageMeta,
    phase: KnownMaaPhase,
    details: Record<string, any>,
    timestamp: string,
    eventOrder: number
  ): boolean => {
    const scopedTaskId = resolveScopedTaskId(params.fixedTaskId, taskId)
    return params.handleSimpleNodeEvent(
      scopedTaskId,
      messageMeta,
      phase,
      details,
      timestamp,
      eventOrder,
      params.handleActionEvent,
      params.handleActionNodeEvent,
      params.onWaitFreezesUpdated,
      params.onRecognitionAttempt,
      params.skipRecognitionRefreshWhenTaskMissingOnFinish
    )
  }
}

export const createScopedPipelineNodeFinalizeHandler = (params: {
  fixedTaskId?: number
  rootTaskId: number
  finalizeTaskPipelineNodeEvent: (
    taskId: number,
    details: Record<string, any>,
    phase: TaskTerminalPhase,
    timestamp: string
  ) => void
  finalizeSubTaskPipelineNodeEvent: (
    subTaskId: number,
    details: Record<string, any>,
    phase: TaskTerminalPhase,
    timestamp: string
  ) => void
}): ScopedPipelineNodeFinalizeHandler => {
  return (
    taskId: number | null,
    details: Record<string, any>,
    phase: TaskTerminalPhase,
    timestamp: string
  ): void => {
    const scopedTaskId = resolveScopedTaskId(params.fixedTaskId, taskId)
    if (scopedTaskId == null) return
    if (scopedTaskId === params.rootTaskId) {
      params.finalizeTaskPipelineNodeEvent(params.rootTaskId, details, phase, timestamp)
    } else {
      params.finalizeSubTaskPipelineNodeEvent(scopedTaskId, details, phase, timestamp)
    }
  }
}
