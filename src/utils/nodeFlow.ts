import type {
  NodeInfo,
  RecognitionAttempt,
  NestedActionNode,
  UnifiedFlowGroup,
  UnifiedFlowItem,
} from '../types'

const flowTitleMap: Record<UnifiedFlowItem['type'], UnifiedFlowGroup['title']> = {
  pipeline_node: 'PipelineNode',
  recognition: 'Recognition',
  recognition_node: 'RecognitionNode',
  action: 'Action',
  action_node: 'ActionNode',
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

const sortFlowTree = (item: UnifiedFlowItem): UnifiedFlowItem => {
  if (!item.children || item.children.length === 0) return item
  const sortedChildren = sortFlowItems(item.children).map(sortFlowTree)
  return {
    ...item,
    children: sortedChildren,
  }
}

const mapRecognitionAttempt = (
  attempt: RecognitionAttempt,
  id: string,
  nestedNode = false
): UnifiedFlowItem => {
  const children = (attempt.nested_nodes ?? []).map((nested, nestedIndex) =>
    mapRecognitionAttempt(nested, `${id}.nested.${nestedIndex}`, true)
  )
  return {
    id,
    type: nestedNode ? 'recognition_node' : 'recognition',
    name: attempt.name,
    status: attempt.status,
    timestamp: attempt.timestamp,
    start_timestamp: attempt.start_timestamp,
    end_timestamp: attempt.end_timestamp,
    reco_id: attempt.reco_id,
    raw: {
      reco_id: attempt.reco_id,
      name: attempt.name,
      timestamp: attempt.timestamp,
      start_timestamp: attempt.start_timestamp,
      end_timestamp: attempt.end_timestamp,
      status: attempt.status,
    },
    reco_details: attempt.reco_details,
    error_image: attempt.error_image,
    vision_image: attempt.vision_image,
    children: children.length > 0 ? sortFlowItems(children) : undefined,
  }
}

const mapActionItem = (
  id: string,
  name: string,
  status: 'success' | 'failed',
  startTimestamp: string | undefined,
  endTimestamp: string | undefined,
  actionDetails: UnifiedFlowItem['action_details'],
  actionId?: number,
  type: 'action' | 'action_node' = 'action'
): UnifiedFlowItem => {
  const fallbackTs = startTimestamp || endTimestamp || ''
  return {
    id,
    type,
    name,
    status,
    timestamp: fallbackTs,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
    action_id: actionId,
    action_details: actionDetails,
    raw: actionDetails ? { ...actionDetails } : undefined,
  }
}

const mapNestedPipelineNode = (
  nestedNode: NestedActionNode,
  groupIndex: number,
  nodeIndex: number,
  ownerTaskId: number
): UnifiedFlowItem => {
  const baseId = `task.${groupIndex}.pipeline.${nodeIndex}.${nestedNode.node_id}`
  const recognitionChildren = (nestedNode.recognition_attempts ?? []).map((attempt, attemptIndex) =>
    mapRecognitionAttempt(attempt, `${baseId}.recognition.${attemptIndex}`)
  )
  const actionChild = nestedNode.action_details
    ? mapActionItem(
        `${baseId}.action.${nestedNode.action_details.action_id ?? nestedNode.node_id}`,
        nestedNode.action_details.name || nestedNode.name,
        nestedNode.action_details.success ? 'success' : 'failed',
        nestedNode.action_details.start_timestamp || nestedNode.start_timestamp,
        nestedNode.action_details.end_timestamp || nestedNode.end_timestamp,
        nestedNode.action_details,
        nestedNode.action_details.action_id,
        'action'
      )
    : null
  const children = actionChild
    ? sortFlowItems([...recognitionChildren, actionChild])
    : sortFlowItems(recognitionChildren)
  return {
    id: baseId,
    type: 'pipeline_node',
    name: nestedNode.name,
    status: nestedNode.status,
    timestamp: nestedNode.start_timestamp || nestedNode.timestamp || nestedNode.end_timestamp || '',
    start_timestamp: nestedNode.start_timestamp || nestedNode.timestamp,
    end_timestamp: nestedNode.end_timestamp,
    task_id: ownerTaskId,
    node_id: nestedNode.node_id,
    reco_details: nestedNode.reco_details,
    action_details: nestedNode.action_details,
    raw: {
      node_id: nestedNode.node_id,
      name: nestedNode.name,
      status: nestedNode.status,
      reco_details: nestedNode.reco_details,
      action_details: nestedNode.action_details,
    },
    children: children.length > 0 ? children : undefined,
  }
}

const buildTaskFlowItems = (node: NodeInfo): UnifiedFlowItem[] => {
  return (node.nested_action_nodes ?? []).map((group, groupIndex) => {
    const pipelineChildren = (group.nested_actions ?? []).map((nested, nodeIndex) =>
      mapNestedPipelineNode(nested, groupIndex, nodeIndex, group.task_id)
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
      raw: group.task_details
        ? { ...group.task_details }
        : {
            task_id: group.task_id,
            name: group.name,
            status: group.status,
            start_timestamp: group.start_timestamp || group.timestamp,
            end_timestamp: group.end_timestamp,
          },
      children: pipelineChildren.length > 0 ? sortFlowItems(pipelineChildren) : undefined,
    }
  })
}

export const buildNodeFlowItems = (node: NodeInfo): UnifiedFlowItem[] => {
  const roots: UnifiedFlowItem[] = []

  const actionLevelRecognitionNodes = (node.nested_recognition_in_action ?? []).map((attempt, attemptIndex) =>
    mapRecognitionAttempt(attempt, `node.action.recognition.${attemptIndex}`, true)
  )

  const taskItems = buildTaskFlowItems(node)

  // 顶层 PipelineNode 的 Node.Recognition / Node.Action 使用结构化字段展示：
  // - recognition_attempts
  // - action_details
  // 这里返回 Action 期间递归产生的事件树（task / pipeline / recognition_node / action_node）。
  roots.push(...actionLevelRecognitionNodes)
  roots.push(...taskItems)

  return sortFlowItems(roots).map(sortFlowTree)
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
  return groupFlowItemsByType(buildNodeFlowItems(node))
}
