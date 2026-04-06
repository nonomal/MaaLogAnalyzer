import type { MergedRecognitionItem, NodeInfo, UnifiedFlowItem } from '../../types'

export type StatusButtonType = 'default' | 'info' | 'success' | 'warning'
export type ResultStatusButtonType = 'success' | 'warning' | 'error'
export type NodeFlowStatus = NodeInfo['status'] | UnifiedFlowItem['status']
export type NodeCardStatus = NodeFlowStatus | MergedRecognitionItem['status']

export const resolveStatusButtonType = (status: NodeCardStatus): StatusButtonType => {
  if (status === 'success') return 'success'
  if (status === 'running') return 'info'
  if (status === 'failed') return 'warning'
  return 'default'
}

export const resolveResultStatusButtonType = (status: NodeCardStatus): ResultStatusButtonType => {
  if (status === 'success') return 'success'
  if (status === 'running') return 'warning'
  return 'error'
}
