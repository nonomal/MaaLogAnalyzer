import type { KnownMaaPhase } from '../event/meta'

export const handleSubTaskActionNodeLifecycleEvent = (params: {
  subTaskId: number | null
  phase: KnownMaaPhase
  details: Record<string, any>
  timestamp: string
  startSubTaskActionNode: (subTaskId: number, details: Record<string, any>, timestamp: string) => void
  finishSubTaskActionNode: (
    subTaskId: number,
    details: Record<string, any>,
    timestamp: string,
    status: 'success' | 'failed'
  ) => void
  resolveTerminalCompletionStatus: (phase: KnownMaaPhase) => 'success' | 'failed'
  refresh: (timestamp: string) => void
}): void => {
  if (params.subTaskId == null) {
    params.refresh(params.timestamp)
    return
  }

  if (params.phase === 'Starting') {
    params.startSubTaskActionNode(params.subTaskId, params.details, params.timestamp)
  } else {
    params.finishSubTaskActionNode(
      params.subTaskId,
      params.details,
      params.timestamp,
      params.resolveTerminalCompletionStatus(params.phase)
    )
  }

  params.refresh(params.timestamp)
}