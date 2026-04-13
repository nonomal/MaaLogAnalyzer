import { describe, expect, it } from 'vitest'
import type { EventNotification } from '@windsland52/maa-log-parser/types'
import { StringPool } from '@windsland52/maa-log-parser/string-pool'
import { parseMaaMessageMeta } from '@windsland52/maa-log-parser/event-meta'
import { buildTasksFromEvents } from '@windsland52/maa-log-parser/task-builder'

const buildTasks = (events: EventNotification[]) => {
  const stringPool = new StringPool()
  return buildTasksFromEvents({
    events,
    stringPool,
    getCachedMaaMessageMeta: parseMaaMessageMeta,
    getTaskNodes: () => [],
  })
}

describe('taskBuilder', () => {
  it('builds synthetic tasks from node events when no task lifecycle events exist', () => {
    const events: EventNotification[] = [
      {
        timestamp: '2026-04-01 10:00:00.000',
        level: 'INF',
        message: 'Node.PipelineNode.Starting',
        details: { task_id: 42, node_id: 1, name: 'NodeA' },
      },
      {
        timestamp: '2026-04-01 10:00:01.000',
        level: 'INF',
        message: 'Node.PipelineNode.Succeeded',
        details: { task_id: 42, node_id: 1, name: 'NodeA' },
      },
      {
        timestamp: '2026-04-01 10:00:02.000',
        level: 'INF',
        message: 'Node.PipelineNode.Starting',
        details: { task_id: 7, node_id: 2, name: 'NodeB' },
      },
    ]

    const tasks = buildTasks(events)

    expect(tasks.map((task) => task.task_id)).toEqual([42, 7])
    expect(tasks[0].entry).toBe('Task#42')
    expect(tasks[0].uuid).toBe('synthetic-42')
    expect(tasks[0]._startEventIndex).toBe(0)
    expect(tasks[0]._endEventIndex).toBe(1)
    expect(tasks[0].events).toHaveLength(2)
    expect(tasks[1].events).toHaveLength(1)
  })

  it('keeps lifecycle-built tasks as primary source and skips synthetic fallback', () => {
    const events: EventNotification[] = [
      {
        timestamp: '2026-04-01 10:00:00.000',
        level: 'INF',
        message: 'Tasker.Task.Starting',
        details: { task_id: 1, entry: 'MainTask', hash: 'h1', uuid: 'u1' },
      },
      {
        timestamp: '2026-04-01 10:00:00.100',
        level: 'INF',
        message: 'Node.PipelineNode.Starting',
        details: { task_id: 2, node_id: 11, name: 'OtherTaskNode' },
      },
      {
        timestamp: '2026-04-01 10:00:01.000',
        level: 'INF',
        message: 'Tasker.Task.Succeeded',
        details: { task_id: 1, entry: 'MainTask', hash: 'h1', uuid: 'u1' },
      },
    ]

    const tasks = buildTasks(events)

    expect(tasks).toHaveLength(1)
    expect(tasks[0].task_id).toBe(1)
    expect(tasks[0].entry).toBe('MainTask')
    expect(tasks[0].status).toBe('succeeded')
  })
})
