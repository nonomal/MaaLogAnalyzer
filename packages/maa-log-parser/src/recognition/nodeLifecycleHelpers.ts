import type { RecognitionAttempt } from '../shared/types'
import { resolveRecognitionNodeRecoId } from '../node/eventValueHelpers'

type EnsureRecognitionNodeAttempt = (
  taskId: number,
  recoId: number,
  details: Record<string, any>,
  startTimestamp: string,
  eventOrder: number
) => RecognitionAttempt

type CompleteRecognitionNodeAttempt = (
  attempt: RecognitionAttempt,
  recoId: number,
  details: Record<string, any>,
  timestamp: string,
  status: 'success' | 'failed',
  eventOrder: number,
  startTimestamp: string
) => void

type FindActiveParentRecognition = (excludeTaskId?: number) => RecognitionAttempt | undefined

export const setRecognitionNodeStartTimestamp = (params: {
  taskId: number
  rootTaskId: number
  recoId: number
  startTimestamp: string
  recognitionNodeStartTimes: Map<number, string>
  subTaskRecognitionNodeStartTimes: Map<string, string>
  scopedKey: (taskId: number, recoId: number) => string
}): void => {
  if (params.taskId === params.rootTaskId) {
    params.recognitionNodeStartTimes.set(params.recoId, params.startTimestamp)
    return
  }
  params.subTaskRecognitionNodeStartTimes.set(
    params.scopedKey(params.taskId, params.recoId),
    params.startTimestamp
  )
}

export const getRecognitionNodeStartTimestamp = (params: {
  taskId: number
  rootTaskId: number
  recoId: number
  fallbackTimestamp: string
  recognitionNodeStartTimes: Map<number, string>
  subTaskRecognitionNodeStartTimes: Map<string, string>
  scopedKey: (taskId: number, recoId: number) => string
}): string => {
  if (params.taskId === params.rootTaskId) {
    return params.recognitionNodeStartTimes.get(params.recoId) || params.fallbackTimestamp
  }
  return params.subTaskRecognitionNodeStartTimes.get(
    params.scopedKey(params.taskId, params.recoId)
  ) || params.fallbackTimestamp
}

export const clearRecognitionNodeStartTimestamp = (params: {
  taskId: number
  rootTaskId: number
  recoId: number
  recognitionNodeStartTimes: Map<number, string>
  subTaskRecognitionNodeStartTimes: Map<string, string>
  scopedKey: (taskId: number, recoId: number) => string
}): void => {
  if (params.taskId === params.rootTaskId) {
    params.recognitionNodeStartTimes.delete(params.recoId)
    return
  }
  params.subTaskRecognitionNodeStartTimes.delete(params.scopedKey(params.taskId, params.recoId))
}

export const startRecognitionNodeEvent = (params: {
  taskId: number
  rootTaskId: number
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  excludeParentTaskId?: number
  dispatchDetachedRecognition?: (attempt: RecognitionAttempt) => void
  recognitionNodeStartTimes: Map<number, string>
  subTaskRecognitionNodeStartTimes: Map<string, string>
  scopedKey: (taskId: number, recoId: number) => string
  ensureRecognitionNodeAttempt: EnsureRecognitionNodeAttempt
  findActiveParentRecognition: FindActiveParentRecognition
  attachNodeToAttempt: (parent: RecognitionAttempt, child: RecognitionAttempt) => void
  intern: (value: string) => string
}): void => {
  const recoId = resolveRecognitionNodeRecoId(params.details)
  if (recoId == null) return
  const startTimestamp = params.intern(params.timestamp)
  setRecognitionNodeStartTimestamp({
    taskId: params.taskId,
    rootTaskId: params.rootTaskId,
    recoId,
    startTimestamp,
    recognitionNodeStartTimes: params.recognitionNodeStartTimes,
    subTaskRecognitionNodeStartTimes: params.subTaskRecognitionNodeStartTimes,
    scopedKey: params.scopedKey,
  })

  const recoNodeAttempt = params.ensureRecognitionNodeAttempt(
    params.taskId,
    recoId,
    params.details,
    startTimestamp,
    params.eventOrder
  )
  const parentRecognition = params.findActiveParentRecognition(params.excludeParentTaskId)
  if (parentRecognition && parentRecognition.reco_id !== recoId) {
    params.attachNodeToAttempt(parentRecognition, recoNodeAttempt)
    return
  }
  if (params.dispatchDetachedRecognition) {
    params.dispatchDetachedRecognition(recoNodeAttempt)
  }
}

export const finalizeRecognitionNodeEvent = (params: {
  taskId: number
  rootTaskId: number
  details: Record<string, any>
  timestamp: string
  status: 'success' | 'failed'
  eventOrder: number
  pendingRecognitions: RecognitionAttempt[]
  dispatchPendingRecognition: (taskId: number, attempt: RecognitionAttempt) => void
  dispatchStandaloneRecognition: (taskId: number, attempt: RecognitionAttempt) => void
  excludeParentTaskId?: number
  recognitionNodeStartTimes: Map<number, string>
  subTaskRecognitionNodeStartTimes: Map<string, string>
  activeRecognitionNodeAttempts: Map<string, RecognitionAttempt>
  scopedKey: (taskId: number, recoId: number) => string
  dedupeRecognitionAttempts: (items: RecognitionAttempt[]) => RecognitionAttempt[]
  completeRecognitionNodeAttempt: CompleteRecognitionNodeAttempt
  findActiveParentRecognition: FindActiveParentRecognition
  attachNodeToAttempt: (parent: RecognitionAttempt, child: RecognitionAttempt) => void
  intern: (value: string) => string
}): void => {
  const parentRecognition = params.findActiveParentRecognition(params.excludeParentTaskId)
  const normalizedPendingRecognitions = params.dedupeRecognitionAttempts(params.pendingRecognitions)

  if (normalizedPendingRecognitions.length > 0) {
    const pendingRecoId = resolveRecognitionNodeRecoId(params.details)
    const pendingNodeKey = pendingRecoId != null ? params.scopedKey(params.taskId, pendingRecoId) : null
    const pendingRecoNodeAttempt = pendingNodeKey
      ? params.activeRecognitionNodeAttempts.get(pendingNodeKey)
      : undefined
    if (pendingRecoNodeAttempt && pendingRecoId != null) {
      const fallbackStartTimestamp = params.intern(params.timestamp)
      const startTimestamp = getRecognitionNodeStartTimestamp({
        taskId: params.taskId,
        rootTaskId: params.rootTaskId,
        recoId: pendingRecoId,
        fallbackTimestamp: fallbackStartTimestamp,
        recognitionNodeStartTimes: params.recognitionNodeStartTimes,
        subTaskRecognitionNodeStartTimes: params.subTaskRecognitionNodeStartTimes,
        scopedKey: params.scopedKey,
      })
      params.completeRecognitionNodeAttempt(
        pendingRecoNodeAttempt,
        pendingRecoId,
        params.details,
        params.timestamp,
        params.status,
        params.eventOrder,
        startTimestamp
      )
    }
    for (const recognition of normalizedPendingRecognitions) {
      const resolvedRecognition = (
        pendingRecoId != null &&
        pendingRecoNodeAttempt &&
        recognition.reco_id === pendingRecoId
      ) ? pendingRecoNodeAttempt : recognition
      if (parentRecognition && parentRecognition.reco_id !== recognition.reco_id) {
        params.attachNodeToAttempt(parentRecognition, resolvedRecognition)
        continue
      }
      params.dispatchPendingRecognition(params.taskId, resolvedRecognition)
    }
    if (pendingRecoId != null) {
      params.activeRecognitionNodeAttempts.delete(params.scopedKey(params.taskId, pendingRecoId))
      clearRecognitionNodeStartTimestamp({
        taskId: params.taskId,
        rootTaskId: params.rootTaskId,
        recoId: pendingRecoId,
        recognitionNodeStartTimes: params.recognitionNodeStartTimes,
        subTaskRecognitionNodeStartTimes: params.subTaskRecognitionNodeStartTimes,
        scopedKey: params.scopedKey,
      })
    }
    return
  }

  const recoId = resolveRecognitionNodeRecoId(params.details)
  if (recoId == null) return
  const fallbackStartTimestamp = params.intern(params.timestamp)
  const startTimestamp = getRecognitionNodeStartTimestamp({
    taskId: params.taskId,
    rootTaskId: params.rootTaskId,
    recoId,
    fallbackTimestamp: fallbackStartTimestamp,
    recognitionNodeStartTimes: params.recognitionNodeStartTimes,
    subTaskRecognitionNodeStartTimes: params.subTaskRecognitionNodeStartTimes,
    scopedKey: params.scopedKey,
  })
  const nodeKey = params.scopedKey(params.taskId, recoId)
  const recoNodeAttempt: RecognitionAttempt = params.activeRecognitionNodeAttempts.get(nodeKey) ?? {
    reco_id: recoId,
    name: params.intern(params.details.name || ''),
    ts: startTimestamp,
    end_ts: startTimestamp,
    status: 'running',
  }
  params.completeRecognitionNodeAttempt(
    recoNodeAttempt,
    recoId,
    params.details,
    params.timestamp,
    params.status,
    params.eventOrder,
    startTimestamp
  )
  clearRecognitionNodeStartTimestamp({
    taskId: params.taskId,
    rootTaskId: params.rootTaskId,
    recoId,
    recognitionNodeStartTimes: params.recognitionNodeStartTimes,
    subTaskRecognitionNodeStartTimes: params.subTaskRecognitionNodeStartTimes,
    scopedKey: params.scopedKey,
  })
  params.activeRecognitionNodeAttempts.delete(nodeKey)
  if (parentRecognition && parentRecognition.reco_id !== recoNodeAttempt.reco_id) {
    params.attachNodeToAttempt(parentRecognition, recoNodeAttempt)
    return
  }
  params.dispatchStandaloneRecognition(params.taskId, recoNodeAttempt)
}