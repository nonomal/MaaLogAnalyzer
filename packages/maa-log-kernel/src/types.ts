export interface EventNotification {
  timestamp: string
  level: string
  message: string
  details: Record<string, unknown>
  _lineNumber?: number
}

export interface NextListItem {
  name: string
  anchor: boolean
  jump_back: boolean
}

export interface RecognitionAttempt {
  reco_id: number
  name: string
  ts: string
  end_ts?: string
  status: 'success' | 'failed' | 'running'
  anchor_name?: string
  reco_details?: unknown
  nested_nodes?: RecognitionAttempt[]
  error_image?: string
  vision_image?: string
}

export interface NodeInfo {
  node_id: number
  name: string
  ts: string
  end_ts?: string
  status: 'success' | 'failed' | 'running'
  task_id: number
  next_list: NextListItem[]
  node_flow?: unknown[]
  recognitions?: RecognitionAttempt[]
}

export interface TaskInfo {
  task_id: number
  entry: string
  hash: string
  uuid: string
  start_time: string
  end_time?: string
  status: 'running' | 'succeeded' | 'failed'
  nodes: NodeInfo[]
  events: EventNotification[]
  duration?: number
}
