import type { NodeInfo } from '../../../../types'
import type { NodeExecutionNavStatus } from '@windsland52/maa-log-tools/node-execution-timeline'

export type NodeNavMatchKind = 'node' | 'next-list' | 'flow'
export type NodeNavStatus = NodeExecutionNavStatus

export interface NodeNavMatchDetail {
  kind: NodeNavMatchKind
  text: string
}

export interface NodeNavViewItem {
  node: NodeInfo
  originalIndex: number
  primaryText: string
  navStatus: NodeNavStatus
  matchDetails: NodeNavMatchDetail[]
  matchKinds: NodeNavMatchKind[]
  matchHint: string
  matchPreview: string
}
