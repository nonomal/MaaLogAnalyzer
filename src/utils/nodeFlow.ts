import type {
  NodeInfo,
  RecognitionAttempt,
  NestedActionNode,
  UnifiedFlowGroup,
  UnifiedFlowItem,
} from '../types'

const flowTitleMap: Record<UnifiedFlowItem['type'], UnifiedFlowGroup['title']> = {
  recognition: 'Recognition',
  action: 'Action',
  task: 'Task',
}

const toTimestampMs = (timestamp?: string): number => {
  if (!timestamp) return Number.POSITIVE_INFINITY
  const normalized = timestamp.includes(' ') ? timestamp.replace(' ', 'T') : timestamp
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const flowItemTimestampMs = (item: UnifiedFlowItem): number => {
  return toTimestampMs(item.start_timestamp || item.timestamp || item.end_timestamp)
}

const FLOW_ATTACH_JITTER_MS = 20

const sortFlowItems = (items: UnifiedFlowItem[]): UnifiedFlowItem[] => {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const delta = flowItemTimestampMs(a.item) - flowItemTimestampMs(b.item)
      if (delta !== 0) return delta
      return a.index - b.index
    })
    .map(({ item }) => item)
}

const mapRecognitionAttempt = (attempt: RecognitionAttempt, id: string): UnifiedFlowItem => {
  const children = (attempt.nested_nodes ?? []).map((nested, nestedIndex) =>
    mapRecognitionAttempt(nested, `${id}.nested.${nestedIndex}`)
  )
  return {
    id,
    type: 'recognition',
    name: attempt.name,
    status: attempt.status,
    timestamp: attempt.timestamp,
    start_timestamp: attempt.start_timestamp,
    end_timestamp: attempt.end_timestamp,
    reco_id: attempt.reco_id,
    reco_details: attempt.reco_details,
    error_image: attempt.error_image,
    vision_image: attempt.vision_image,
    children: children.length > 0 ? sortFlowItems(children) : undefined,
  }
}

const mapNestedActionNode = (
  action: NestedActionNode,
  groupIndex: number,
  actionIndex: number,
  ownerTaskId: number
): UnifiedFlowItem => {
  const recognitionChildren = (action.recognition_attempts ?? []).map((attempt, attemptIndex) =>
    mapRecognitionAttempt(attempt, `task.${groupIndex}.action.${actionIndex}.reco.${attemptIndex}`)
  )
  return {
    id: `task.${groupIndex}.action.${actionIndex}.${action.node_id}`,
    type: 'action',
    name: action.name,
    status: action.status,
    timestamp: action.timestamp,
    start_timestamp: action.start_timestamp,
    end_timestamp: action.end_timestamp,
    task_id: ownerTaskId,
    node_id: action.node_id,
    action_id: action.action_details?.action_id,
    action_details: action.action_details,
    reco_details: action.reco_details,
    children: recognitionChildren.length > 0 ? sortFlowItems(recognitionChildren) : undefined,
  }
}

const sortFlowTree = (item: UnifiedFlowItem): UnifiedFlowItem => {
  if (!item.children || item.children.length === 0) return item
  const sortedChildren = sortFlowItems(item.children).map(sortFlowTree)
  return {
    ...item,
    children: sortedChildren,
  }
}

const getItemRangeMs = (item: UnifiedFlowItem): { start: number; end: number } | null => {
  const startMs = toTimestampMs(item.start_timestamp || item.timestamp)
  const endMsRaw = toTimestampMs(item.end_timestamp || item.timestamp || item.start_timestamp)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMsRaw)) return null
  const start = Math.min(startMs, endMsRaw)
  const end = Math.max(startMs, endMsRaw)
  return { start, end }
}

const canContainTimestamp = (actionItem: UnifiedFlowItem, targetMs: number): boolean => {
  if (actionItem.type !== 'action') return false
  const range = getItemRangeMs(actionItem)
  if (!range) return false
  return targetMs >= range.start - FLOW_ATTACH_JITTER_MS && targetMs <= range.end + FLOW_ATTACH_JITTER_MS
}

const attachChild = (parent: UnifiedFlowItem, child: UnifiedFlowItem): void => {
  const next = parent.children ? [...parent.children, child] : [child]
  parent.children = sortFlowItems(next)
}

const findBestActionParent = (roots: UnifiedFlowItem[], child: UnifiedFlowItem): UnifiedFlowItem | null => {
  const targetMs = flowItemTimestampMs(child)
  if (!Number.isFinite(targetMs)) return null

  type Candidate = {
    item: UnifiedFlowItem
    depth: number
    span: number
    start: number
  }

  let best: Candidate | null = null

  const visit = (item: UnifiedFlowItem, depth: number) => {
    if (item.type === 'action' && item.task_id !== child.task_id && canContainTimestamp(item, targetMs)) {
      const range = getItemRangeMs(item)
      if (range) {
        const span = range.end - range.start
        const candidate: Candidate = {
          item,
          depth,
          span,
          start: range.start,
        }
        if (!best) {
          best = candidate
        } else if (candidate.depth > best.depth) {
          best = candidate
        } else if (candidate.depth === best.depth && candidate.span < best.span) {
          best = candidate
        } else if (candidate.depth === best.depth && candidate.span === best.span && candidate.start > best.start) {
          best = candidate
        }
      }
    }

    if (item.children && item.children.length > 0) {
      for (const childItem of item.children) {
        visit(childItem, depth + 1)
      }
    }
  }

  for (const root of roots) {
    visit(root, 0)
  }
  const resolvedBest = best as Candidate | null
  return resolvedBest ? resolvedBest.item : null
}

const buildTaskFlowItems = (node: NodeInfo): UnifiedFlowItem[] => {
  return (node.nested_action_nodes ?? []).map((group, groupIndex) => {
    const actionChildren = (group.nested_actions ?? []).map((action, actionIndex) =>
      mapNestedActionNode(action, groupIndex, actionIndex, group.task_id)
    )
    return {
      id: `node.task.${groupIndex}.${group.task_id}`,
      type: 'task' as const,
      name: group.name,
      status: group.status,
      timestamp: group.timestamp,
      start_timestamp: group.start_timestamp || group.timestamp,
      end_timestamp: group.end_timestamp,
      task_id: group.task_id,
      task_details: group.task_details,
      children: actionChildren.length > 0 ? sortFlowItems(actionChildren) : undefined,
    }
  })
}

export const buildNodeFlowItems = (node: NodeInfo): UnifiedFlowItem[] => {
  const flowItems: UnifiedFlowItem[] = []

  const topRecognitions = (node.recognition_attempts ?? []).map((attempt, attemptIndex) =>
    mapRecognitionAttempt(attempt, `node.recognition.${attemptIndex}`)
  )
  flowItems.push(...topRecognitions)

  const actionLevelRecognitions = (node.nested_recognition_in_action ?? []).map((attempt, attemptIndex) =>
    mapRecognitionAttempt(attempt, `node.action.recognition.${attemptIndex}`)
  )

  const taskItems = buildTaskFlowItems(node)

  if (node.action_details) {
    const actionTimestamp =
      node.action_details.start_timestamp ||
      node.action_details.end_timestamp ||
      node.end_timestamp ||
      node.timestamp
    const rootActionItem: UnifiedFlowItem = {
      id: `node.action.${node.action_details.action_id}`,
      type: 'action',
      name: node.action_details.name,
      status: node.action_details.success ? 'success' : 'failed',
      timestamp: actionTimestamp,
      start_timestamp: node.action_details.start_timestamp,
      end_timestamp: node.action_details.end_timestamp,
      action_id: node.action_details.action_id,
      action_details: node.action_details,
    }

    // 优先把 action 级识别和 task 挂到最合适的 action（支持多层嵌套）
    const pendingChildren = sortFlowItems([
      ...actionLevelRecognitions,
      ...taskItems,
    ])
    for (const child of pendingChildren) {
      const parent = findBestActionParent([rootActionItem], child)
      attachChild(parent ?? rootActionItem, child)
    }

    flowItems.push(sortFlowTree(rootActionItem))
  } else {
    // 无主 action: 在根层中尽量按时间挂到最合适的 action，否则保持根层。
    const roots = [...sortFlowItems(actionLevelRecognitions)]
    const pendingTasks = sortFlowItems(taskItems)
    for (const taskItem of pendingTasks) {
      const parent = findBestActionParent(roots, taskItem)
      if (parent) {
        attachChild(parent, taskItem)
      } else {
        roots.push(taskItem)
      }
    }
    flowItems.push(...sortFlowItems(roots).map(sortFlowTree))
  }

  return sortFlowItems(flowItems)
}

export const groupFlowItemsByType = (items: UnifiedFlowItem[]): UnifiedFlowGroup[] => {
  const groups: UnifiedFlowGroup[] = []
  for (const item of items) {
    const previous = groups.length > 0 ? groups[groups.length - 1] : undefined
    if (previous && previous.type === item.type) {
      previous.items.push(item)
      continue
    }
    groups.push({
      type: item.type,
      title: flowTitleMap[item.type],
      items: [item],
    })
  }
  return groups
}

export const buildNodeFlowGroups = (node: NodeInfo): UnifiedFlowGroup[] => {
  const items = node.flow_items && node.flow_items.length > 0
    ? node.flow_items
    : buildNodeFlowItems(node)
  return groupFlowItemsByType(items)
}
