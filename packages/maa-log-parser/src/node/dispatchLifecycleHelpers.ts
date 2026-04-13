import type { RecognitionAttempt } from '../shared/types'
import {
  type KnownMaaPhase,
  type MaaMessageMeta,
  toKnownMaaPhase,
  type TaskTerminalPhase,
} from '../event/meta'
import type { ScopedNodeDispatchConfig } from './scopedDispatchHelpers'

export const handleRecognitionNodeLifecycleEvent = (params: {
  taskId: number | null
  phase: KnownMaaPhase
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  dispatchPendingRecognition: (taskId: number, recognition: RecognitionAttempt) => void
  dispatchStandaloneRecognition: (taskId: number, recognition: RecognitionAttempt) => void
  excludeParentTaskId?: number
  dispatchDetachedRecognition?: (recognition: RecognitionAttempt) => void
  startRecognitionNodeEvent: (
    taskId: number,
    details: Record<string, any>,
    timestamp: string,
    eventOrder: number,
    excludeParentTaskId?: number,
    dispatchDetachedRecognition?: (attempt: RecognitionAttempt) => void
  ) => void
  finalizeRecognitionNodeEvent: (
    taskId: number,
    details: Record<string, any>,
    timestamp: string,
    status: 'success' | 'failed',
    eventOrder: number,
    pendingRecognitions: RecognitionAttempt[],
    dispatchPendingRecognition: (taskId: number, attempt: RecognitionAttempt) => void,
    dispatchStandaloneRecognition: (taskId: number, attempt: RecognitionAttempt) => void,
    excludeParentTaskId?: number
  ) => void
  resolveTerminalCompletionStatus: (phase: TaskTerminalPhase) => 'success' | 'failed'
  consumeRecognitions: (taskId: number) => RecognitionAttempt[]
  refresh: (timestamp: string) => void
}): void => {
  if (params.phase === 'Starting') {
    if (params.taskId == null) return
    params.startRecognitionNodeEvent(
      params.taskId,
      params.details,
      params.timestamp,
      params.eventOrder,
      params.excludeParentTaskId,
      params.dispatchDetachedRecognition
    )
    params.refresh(params.timestamp)
    return
  }

  if (params.taskId == null) return
  params.finalizeRecognitionNodeEvent(
    params.taskId,
    params.details,
    params.timestamp,
    params.resolveTerminalCompletionStatus(params.phase as TaskTerminalPhase),
    params.eventOrder,
    params.consumeRecognitions(params.taskId),
    params.dispatchPendingRecognition,
    params.dispatchStandaloneRecognition,
    params.excludeParentTaskId
  )
  params.refresh(params.timestamp)
}

export const handleScopedNodeEvent = (params: {
  taskId: number | null
  messageMeta: MaaMessageMeta
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  config: ScopedNodeDispatchConfig
  handleRecognitionNodeLifecycleEvent: (args: {
    taskId: number | null
    phase: KnownMaaPhase
    details: Record<string, any>
    timestamp: string
    eventOrder: number
    dispatchPendingRecognition: (taskId: number, recognition: RecognitionAttempt) => void
    dispatchStandaloneRecognition: (taskId: number, recognition: RecognitionAttempt) => void
    excludeParentTaskId?: number
    dispatchDetachedRecognition?: (recognition: RecognitionAttempt) => void
  }) => void
}): void => {
  const phase = toKnownMaaPhase(params.messageMeta.phase)
  if (!phase) return
  const excludeParentTaskId = params.config.excludeTaskIdFromParentRecognitionLookup
    ? (params.taskId ?? undefined)
    : undefined
  if (params.config.handleSimpleNodeEvent(
    params.taskId,
    params.messageMeta,
    phase,
    params.details,
    params.timestamp,
    params.eventOrder
  )) {
    return
  }

  switch (params.messageMeta.nodeKind) {
    case 'RecognitionNode':
      params.handleRecognitionNodeLifecycleEvent({
        taskId: params.taskId,
        phase,
        details: params.details,
        timestamp: params.timestamp,
        eventOrder: params.eventOrder,
        dispatchPendingRecognition: params.config.dispatchPendingRecognition,
        dispatchStandaloneRecognition: params.config.dispatchStandaloneRecognition,
        excludeParentTaskId,
        dispatchDetachedRecognition: params.config.dispatchDetachedRecognition,
      })
      return
    case 'PipelineNode':
      if (phase === 'Starting') {
        params.config.handlePipelineNodeStarting(params.taskId, params.details, params.timestamp)
      } else {
        params.config.handlePipelineNodeFinalize(params.taskId, params.details, phase, params.timestamp)
      }
      return
    default:
      return
  }
}