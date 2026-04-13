import type { NodeInfo } from '../shared/types'
import type { KnownMaaPhase } from '../event/meta'
import type { ActionRuntimeState } from './runtimeHelpers'

export const createCurrentTaskActionRuntimeState = (params: {
  actionId: number
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  status: 'running' | 'success' | 'failed'
  resolveActionName: (details: Record<string, any>, fallbackName?: string) => string
}): ActionRuntimeState => {
  return {
    action_id: params.actionId,
    name: params.resolveActionName(params.details),
    ts: params.timestamp,
    end_ts: params.timestamp,
    status: params.status,
    order: params.eventOrder,
  }
}

export const handleCurrentTaskActionEvent = (params: {
  phase: KnownMaaPhase
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  actionStartTimes: Map<number, string>
  actionEndTimes: Map<number, string>
  actionStartOrders: Map<number, number>
  actionEndOrders: Map<number, number>
  actionRuntimeStates: Map<number, ActionRuntimeState>
  readNumberField: (details: Record<string, any>, field: string) => number | undefined
  resolveRuntimeStatusFromPhase: (phase: KnownMaaPhase) => 'running' | 'success' | 'failed'
  resolveActionName: (details: Record<string, any>, fallbackName?: string) => string
  intern: (value: string) => string
  refresh: (timestamp: string) => void
}): void => {
  const actionId = params.readNumberField(params.details, 'action_id')
  if (actionId == null) {
    params.refresh(params.timestamp)
    return
  }

  const isStarting = params.phase === 'Starting'
  if (isStarting) {
    const startTimestamp = params.intern(params.timestamp)
    params.actionStartTimes.set(actionId, startTimestamp)
    params.actionStartOrders.set(actionId, params.eventOrder)
    params.actionRuntimeStates.set(
      actionId,
      createCurrentTaskActionRuntimeState({
        actionId,
        details: params.details,
        timestamp: startTimestamp,
        eventOrder: params.eventOrder,
        status: 'running',
        resolveActionName: params.resolveActionName,
      })
    )
  } else {
    const endTimestamp = params.intern(params.timestamp)
    params.actionEndTimes.set(actionId, endTimestamp)
    params.actionEndOrders.set(actionId, params.eventOrder)
    const existing = params.actionRuntimeStates.get(actionId)
    const terminalStatus = params.resolveRuntimeStatusFromPhase(params.phase)
    if (existing) {
      existing.status = terminalStatus
      existing.end_ts = endTimestamp
      existing.name = params.resolveActionName(params.details, existing.name)
    } else {
      params.actionRuntimeStates.set(
        actionId,
        createCurrentTaskActionRuntimeState({
          actionId,
          details: params.details,
          timestamp: endTimestamp,
          eventOrder: params.eventOrder,
          status: terminalStatus,
          resolveActionName: params.resolveActionName,
        })
      )
    }
  }

  params.refresh(params.timestamp)
}

export const handleSubTaskActionEvent = (params: {
  subTaskId: number | null
  phase: KnownMaaPhase
  details: Record<string, any>
  timestamp: string
  eventOrder: number
  subTaskActionStartTimes: Map<string, string>
  subTaskActionEndTimes: Map<string, string>
  subTaskActionStartOrders: Map<string, number>
  subTaskActionEndOrders: Map<string, number>
  resolveSubTaskActionKey: (taskId: number, actionId: number | null | undefined) => string | null
  readNumberField: (details: Record<string, any>, field: string) => number | undefined
  resolveRuntimeStatusFromPhase: (phase: KnownMaaPhase) => 'running' | 'success' | 'failed'
  resolveActionName: (details: Record<string, any>, fallbackName?: string) => string
  withTimestamps: (
    actionDetails: any,
    startTimestamp?: string,
    endTimestamp?: string,
    fallbackEndTimestamp?: string
  ) => NodeInfo['action_details']
  addSubTaskAction: (subTaskId: number, action: {
    action_id: number | undefined
    name: string
    ts: string
    end_ts: string
    status: 'running' | 'success' | 'failed'
    action_details?: NodeInfo['action_details']
  }) => void
  intern: (value: string) => string
  refresh: (timestamp: string) => void
}): void => {
  if (params.subTaskId == null) {
    params.refresh(params.timestamp)
    return
  }

  const actionId = params.readNumberField(params.details, 'action_id')
  if (params.phase === 'Starting') {
    if (actionId != null) {
      const actionKey = params.resolveSubTaskActionKey(params.subTaskId, actionId)
      if (actionKey) {
        params.subTaskActionStartTimes.set(actionKey, params.intern(params.timestamp))
        params.subTaskActionStartOrders.set(actionKey, params.eventOrder)
      }
    }
  } else {
    const actionKey = params.resolveSubTaskActionKey(params.subTaskId, actionId)
    const endTimestamp = params.intern(params.timestamp)
    const startTimestamp = actionKey
      ? (params.subTaskActionStartTimes.get(actionKey) || endTimestamp)
      : endTimestamp
    if (actionKey) {
      params.subTaskActionEndTimes.set(actionKey, endTimestamp)
      params.subTaskActionEndOrders.set(actionKey, params.eventOrder)
    }
    params.addSubTaskAction(params.subTaskId, {
      action_id: actionId,
      name: params.resolveActionName(params.details),
      ts: startTimestamp,
      end_ts: endTimestamp,
      status: params.resolveRuntimeStatusFromPhase(params.phase),
      action_details: params.withTimestamps(params.details.action_details, startTimestamp, endTimestamp, endTimestamp),
    })
  }

  params.refresh(params.timestamp)
}

export const handleCurrentTaskActionNodeEvent = (params: {
  phase: KnownMaaPhase
  details: Record<string, any>
  timestamp: string
  actionNodeStartTimes: Map<number, string>
  resolveActionNodeEventId: (details: Record<string, any>) => number | undefined
  intern: (value: string) => string
  refresh: (timestamp: string) => void
}): void => {
  const actionId = params.resolveActionNodeEventId(params.details)
  if (actionId != null) {
    if (params.phase === 'Starting') {
      params.actionNodeStartTimes.set(actionId, params.intern(params.timestamp))
    } else {
      params.actionNodeStartTimes.delete(actionId)
    }
  }
  params.refresh(params.timestamp)
}
