export interface NodeStatistics {
  name: string
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  successCount: number
  failCount: number
  successRate: number
  durations: number[]
}

export interface RecognitionActionStatistics {
  name: string
  count: number
  avgRecognitionDuration: number
  minRecognitionDuration: number
  maxRecognitionDuration: number
  totalRecognitionDuration: number
  recognitionCount: number
  avgActionDuration: number
  minActionDuration: number
  maxActionDuration: number
  totalActionDuration: number
  actionCount: number
  avgRecognitionAttempts: number
  totalRecognitionAttempts: number
  successCount: number
  failCount: number
  successRate: number
}
