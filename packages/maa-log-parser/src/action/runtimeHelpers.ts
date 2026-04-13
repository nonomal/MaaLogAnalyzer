import type { NestedActionNode } from '../shared/types'

export type ActionRuntimeState = {
  action_id: number
  name: string
  ts: string
  end_ts?: string
  status: 'running' | 'success' | 'failed'
  order: number
}

export function getLatestActionRuntimeState(
  actionRuntimeStates: Map<number, ActionRuntimeState>
): ActionRuntimeState | null {
  let latest: ActionRuntimeState | null = null
  for (const state of actionRuntimeStates.values()) {
    if (!latest || state.order > latest.order) {
      latest = state
    }
  }
  return latest
}

export function dedupeNestedActionNodes(items: NestedActionNode[]): NestedActionNode[] {
  const seen = new Set<string>()
  const result: NestedActionNode[] = []
  for (const item of items) {
    const key = `${item.node_id}|${item.name}|${item.ts}|${item.status}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}