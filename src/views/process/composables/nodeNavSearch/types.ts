import type { NodeInfo } from '../../../../types'
import type { NodeExecutionNavStatus } from '@windsland52/maa-log-tools/node-execution-timeline'

export type NodeNavMatchKind = 'node' | 'next-list' | 'flow' | 'focus'
export type NodeNavStatus = NodeExecutionNavStatus
export type NodeNavFocusKind = 'node' | 'recognition' | 'action' | 'flow'

export interface NodeNavMatchDetail {
  kind: NodeNavMatchKind
  text: string
}

export interface NodeNavViewItem {
  navKey: string
  node: NodeInfo
  originalIndex: number
  primaryText: string
  navStatus: NodeNavStatus
  targetFlowItemId?: string
  focusKind?: NodeNavFocusKind
  focusDisplay?: string
  matchDetails: NodeNavMatchDetail[]
  matchKinds: NodeNavMatchKind[]
  matchHint: string
  matchPreview: string
}
