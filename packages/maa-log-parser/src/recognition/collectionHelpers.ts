import type { RecognitionAttempt } from '../shared/types'

export function hasRecognitionByRecoId(items: RecognitionAttempt[], recoId: number): boolean {
  return items.some(item => item.reco_id === recoId)
}

export function pushActionLevelRecognitionIfUnknown(
  currentTaskRecognitions: RecognitionAttempt[],
  actionLevelRecognitionNodes: RecognitionAttempt[],
  attempt: RecognitionAttempt
): void {
  const knownInCurrentTask = hasRecognitionByRecoId(currentTaskRecognitions, attempt.reco_id)
  if (knownInCurrentTask) return
  const knownInActionLevel = hasRecognitionByRecoId(actionLevelRecognitionNodes, attempt.reco_id)
  if (knownInActionLevel) return
  actionLevelRecognitionNodes.push(attempt)
}