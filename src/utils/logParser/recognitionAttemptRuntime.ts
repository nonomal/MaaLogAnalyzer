import { markRaw } from 'vue'
import type { RecognitionAttempt } from '../../types'
import type { StringPool } from '../stringPool'

type ActiveRecognitionFrame = { taskId: number; recoId: number }

type CreateRecognitionAttemptRuntimeParams = {
  stringPool: StringPool
  activeRecognitionAttempts: Map<string, RecognitionAttempt>
  activeRecognitionStack: ActiveRecognitionFrame[]
  finishedRecognitionKeys: Set<string>
  recognitionOrderMeta: WeakMap<RecognitionAttempt, { startSeq: number; endSeq: number }>
  scopedKey: (taskId: number, recoId: number) => string
  parseAnchorName: (details: Record<string, any>) => string | undefined
  findRecognitionImage: (timestamp: string, nodeName: string) => string | undefined
  findVisionImage: (timestamp: string, nodeName: string, recoId: number) => string | undefined
}

export function createRecognitionAttemptRuntime(params: CreateRecognitionAttemptRuntimeParams) {
  const {
    stringPool,
    activeRecognitionAttempts,
    activeRecognitionStack,
    finishedRecognitionKeys,
    recognitionOrderMeta,
    scopedKey,
    parseAnchorName,
    findRecognitionImage,
    findVisionImage,
  } = params

  const removeFromActiveRecognitionStack = (taskId: number, recoId: number) => {
    for (let i = activeRecognitionStack.length - 1; i >= 0; i--) {
      const frame = activeRecognitionStack[i]
      if (frame.taskId === taskId && frame.recoId === recoId) {
        activeRecognitionStack.splice(i, 1)
        return
      }
    }
  }

  const startRecognitionAttempt = (
    taskId: number,
    details: Record<string, any>,
    timestamp: string,
    eventOrder: number
  ): RecognitionAttempt | undefined => {
    const rawRecoId = details.reco_id
    const recoId = typeof rawRecoId === 'number' ? rawRecoId : Number(rawRecoId)
    if (!Number.isFinite(recoId)) return undefined
    const key = scopedKey(taskId, recoId)
    if (finishedRecognitionKeys.has(key)) return undefined
    const existing = activeRecognitionAttempts.get(key)
    if (existing) {
      const parsedAnchorName = parseAnchorName(details)
      if (parsedAnchorName && !existing.anchor_name) {
        existing.anchor_name = parsedAnchorName
      }
      return existing
    }

    const startTimestamp = stringPool.intern(timestamp)
    const parsedAnchorName = parseAnchorName(details)
    const attempt: RecognitionAttempt = {
      reco_id: recoId,
      name: stringPool.intern(details.name || ''),
      ts: startTimestamp,
      end_ts: startTimestamp,
      status: 'running',
      ...(parsedAnchorName ? { anchor_name: parsedAnchorName } : {}),
    }
    recognitionOrderMeta.set(attempt, { startSeq: eventOrder, endSeq: eventOrder })
    activeRecognitionAttempts.set(key, attempt)
    activeRecognitionStack.push({ taskId, recoId })
    return attempt
  }

  const finishRecognitionAttempt = (
    taskId: number,
    details: Record<string, any>,
    timestamp: string,
    status: 'success' | 'failed',
    eventOrder: number
  ): RecognitionAttempt | undefined => {
    const rawRecoId = details.reco_id
    const recoId = typeof rawRecoId === 'number' ? rawRecoId : Number(rawRecoId)
    if (!Number.isFinite(recoId)) return undefined
    const key = scopedKey(taskId, recoId)
    if (finishedRecognitionKeys.has(key)) return undefined

    const endTimestamp = stringPool.intern(timestamp)
    const existing = activeRecognitionAttempts.get(key)
    const attempt: RecognitionAttempt = existing ?? {
      reco_id: recoId,
      name: stringPool.intern(details.name || ''),
      ts: endTimestamp,
      end_ts: endTimestamp,
      status,
    }

    attempt.status = status
    attempt.name = attempt.name || stringPool.intern(details.name || '')
    attempt.ts = attempt.ts || endTimestamp
    attempt.end_ts = endTimestamp
    if (!attempt.anchor_name) {
      const parsedAnchorName = parseAnchorName(details)
      if (parsedAnchorName) {
        attempt.anchor_name = parsedAnchorName
      }
    }
    if (details.reco_details) {
      attempt.reco_details = markRaw(details.reco_details)
    }
    attempt.error_image = findRecognitionImage(timestamp, details.name || '')
    attempt.vision_image = findVisionImage(timestamp, details.name || '', recoId)

    const existingMeta = recognitionOrderMeta.get(attempt)
    recognitionOrderMeta.set(attempt, {
      startSeq: existingMeta?.startSeq ?? eventOrder,
      endSeq: eventOrder,
    })

    activeRecognitionAttempts.delete(key)
    removeFromActiveRecognitionStack(taskId, recoId)
    finishedRecognitionKeys.add(key)
    return attempt
  }

  const findActiveParentRecognition = (excludeTaskId?: number): RecognitionAttempt | undefined => {
    for (let i = activeRecognitionStack.length - 1; i >= 0; i--) {
      const frame = activeRecognitionStack[i]
      if (excludeTaskId != null && frame.taskId === excludeTaskId) continue
      const attempt = activeRecognitionAttempts.get(scopedKey(frame.taskId, frame.recoId))
      if (attempt) return attempt
    }
    return undefined
  }

  return {
    startRecognitionAttempt,
    finishRecognitionAttempt,
    findActiveParentRecognition,
  }
}
