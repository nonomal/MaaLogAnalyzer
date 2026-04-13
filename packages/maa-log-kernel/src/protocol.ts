import type { EventNotification, TaskInfo } from './types'
import type { NodeStatistics, RecognitionActionStatistics } from './statistics'

export const MLA_KERNEL_SCHEMA_VERSION = '1.0.0'

export interface KernelOutputMeta {
  schemaVersion: string
  parserVersion: string
  generatedAt: string
}

export interface KernelStatistics {
  nodes: NodeStatistics[]
  recognitionActions: RecognitionActionStatistics[]
}

export interface KernelOutput {
  meta: KernelOutputMeta
  tasks: TaskInfo[]
  events: EventNotification[]
  stats: KernelStatistics
  warnings: string[]
}
