import type { EventNotification } from '../shared/types'
import type { MaaMessageMeta } from '../event/meta'
import type { TaskLifecycleMetaEventContext } from './lifecycle'
import { handleTaskLifecycleMetaEvent, resolveEventTaskId } from './lifecycle'
import type { ScopedNodeDispatchConfig } from '../node/scopedDispatchHelpers'

export const processTaskEvents = (params: {
  taskEvents: EventNotification[]
  rootTaskId: number
  getCachedMaaMessageMeta: (message: string) => MaaMessageMeta
  taskLifecycleMetaContext: TaskLifecycleMetaEventContext
  handleScopedNodeEvent: (
    taskId: number | null,
    messageMeta: MaaMessageMeta,
    details: Record<string, any>,
    timestamp: string,
    eventOrder: number,
    config: ScopedNodeDispatchConfig
  ) => void
  currentTaskNodeDispatchConfig: ScopedNodeDispatchConfig
  subTaskNodeDispatchConfig: ScopedNodeDispatchConfig
}): void => {
  for (let eventIndex = 0; eventIndex < params.taskEvents.length; eventIndex++) {
    const event = params.taskEvents[eventIndex]
    const eventOrder = eventIndex
    const timestamp = event.timestamp
    const { message, details } = event
    const messageMeta = params.getCachedMaaMessageMeta(message)
    const eventTaskId = resolveEventTaskId(details)

    handleTaskLifecycleMetaEvent(
      params.taskLifecycleMetaContext,
      messageMeta,
      eventTaskId,
      details,
      message,
      timestamp,
    )

    if (messageMeta.domain !== 'Node') continue
    const isCurrentTask = eventTaskId === params.rootTaskId

    params.handleScopedNodeEvent(
      isCurrentTask ? params.rootTaskId : (eventTaskId ?? null),
      messageMeta,
      details,
      timestamp,
      eventOrder,
      isCurrentTask ? params.currentTaskNodeDispatchConfig : params.subTaskNodeDispatchConfig
    )
  }
}
