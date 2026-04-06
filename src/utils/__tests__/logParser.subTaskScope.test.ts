import { describe, expect, it } from 'vitest'
import type { UnifiedFlowItem } from '../../types'
import { LogParser } from '../logParser'

const formatTimestamp = (eventIndex: number): string => {
  const second = Math.floor(eventIndex / 1000)
  const millisecond = eventIndex % 1000
  const secondPart = String(second).padStart(2, '0')
  const msPart = String(millisecond).padStart(3, '0')
  return `2026-04-06 10:00:${secondPart}.${msPart}`
}

const makeEventLine = (
  eventIndex: number,
  message: string,
  details: Record<string, unknown>
): string => {
  return `[${formatTimestamp(eventIndex)}][INF][Px1][Tx1][test] !!!OnEventNotify!!! [handle=1] [msg=${message}] [details=${JSON.stringify(details)}]`
}

const collectFlowItems = (
  items: UnifiedFlowItem[] | undefined,
  matcher: (item: UnifiedFlowItem, path: UnifiedFlowItem[]) => boolean
): Array<{ item: UnifiedFlowItem; path: UnifiedFlowItem[] }> => {
  if (!items || items.length === 0) return []

  const result: Array<{ item: UnifiedFlowItem; path: UnifiedFlowItem[] }> = []
  const visit = (nodes: UnifiedFlowItem[], path: UnifiedFlowItem[]) => {
    for (const node of nodes) {
      const nextPath = [...path, node]
      if (matcher(node, nextPath)) {
        result.push({ item: node, path: nextPath })
      }
      if (node.children && node.children.length > 0) {
        visit(node.children, nextPath)
      }
    }
  }

  visit(items, [])
  return result
}

describe('LogParser sub task scoped node aggregation', () => {
  it('keeps main and sub task NextList/WaitFreezes isolated by task_id scope', async () => {
    const lines = [
      makeEventLine(1, 'Tasker.Task.Starting', { task_id: 1, entry: 'MainTask', hash: 'h-main', uuid: 'u-main' }),
      makeEventLine(2, 'Node.PipelineNode.Starting', { task_id: 1, node_id: 101, name: 'MainNode' }),
      makeEventLine(3, 'Node.NextList.Starting', {
        task_id: 1,
        name: 'MainNode',
        list: [{ name: 'MainNext', anchor: false, jump_back: false }],
      }),
      makeEventLine(4, 'Tasker.Task.Starting', { task_id: 2, entry: 'SubTask', hash: 'h-sub', uuid: 'u-sub' }),
      makeEventLine(5, 'Node.PipelineNode.Starting', { task_id: 2, node_id: 201, name: 'SubNode' }),
      makeEventLine(6, 'Node.NextList.Starting', {
        task_id: 2,
        name: 'SubNode',
        list: [{ name: 'SubNext', anchor: true, jump_back: false }],
      }),
      makeEventLine(7, 'Node.WaitFreezes.Starting', { task_id: 2, wf_id: 1, phase: 'pre', name: 'SubNode' }),
      makeEventLine(8, 'Node.WaitFreezes.Succeeded', {
        task_id: 2,
        wf_id: 1,
        phase: 'post',
        name: 'SubNode',
        elapsed: 33,
      }),
      makeEventLine(9, 'Node.PipelineNode.Succeeded', { task_id: 2, node_id: 201, name: 'SubNode' }),
      makeEventLine(10, 'Tasker.Task.Succeeded', { task_id: 2, entry: 'SubTask', hash: 'h-sub', uuid: 'u-sub' }),
      makeEventLine(11, 'Node.WaitFreezes.Starting', { task_id: 1, wf_id: 1, phase: 'repeat', name: 'MainNode' }),
      makeEventLine(12, 'Node.WaitFreezes.Failed', {
        task_id: 1,
        wf_id: 1,
        phase: 'repeat',
        name: 'MainNode',
        elapsed: 66,
      }),
      makeEventLine(13, 'Node.PipelineNode.Succeeded', { task_id: 1, node_id: 101, name: 'MainNode' }),
      makeEventLine(14, 'Tasker.Task.Succeeded', { task_id: 1, entry: 'MainTask', hash: 'h-main', uuid: 'u-main' }),
    ]

    const parser = new LogParser()
    await parser.parseFile(lines.join('\n'))
    const tasks = parser.getTasksSnapshot()
    const mainTask = tasks.find(item => item.task_id === 1)

    expect(mainTask).toBeTruthy()
    expect(mainTask?.nodes.length).toBe(1)

    const mainNode = mainTask!.nodes[0]
    expect(mainNode.next_list).toEqual([
      { name: 'MainNext', anchor: false, jump_back: false },
    ])

    const allWaitFreezes = collectFlowItems(
      mainNode.node_flow,
      (item) => item.type === 'wait_freezes'
    )
    expect(allWaitFreezes.length).toBeGreaterThanOrEqual(2)

    const mainWaitFreezes = allWaitFreezes.find(
      ({ item }) =>
        item.wait_freezes_details?.wf_id === 1 &&
        item.wait_freezes_details?.phase === 'repeat' &&
        item.status === 'failed'
    )
    expect(mainWaitFreezes).toBeTruthy()

    const subWaitFreezes = allWaitFreezes.find(
      ({ item }) =>
        item.wait_freezes_details?.wf_id === 1 &&
        item.wait_freezes_details?.phase === 'post' &&
        item.status === 'success'
    )
    expect(subWaitFreezes).toBeTruthy()
    expect(subWaitFreezes?.path.some(pathNode => pathNode.type === 'task' && pathNode.task_id === 2)).toBe(true)
  })
})

