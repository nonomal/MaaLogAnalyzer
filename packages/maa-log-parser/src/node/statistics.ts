import type { TaskInfo } from '../shared/types'
import { buildNodeRecognitionAttempts } from './flow'

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

export class NodeStatisticsAnalyzer {
  static analyze(tasks: TaskInfo[]): NodeStatistics[] {
    const statsMap = new Map<string, {
      durations: number[]
      successCount: number
      failCount: number
    }>()

    for (const task of tasks) {
      const nodes = task.nodes

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const nextNode = nodes[i + 1]

        let duration = 0
        if (nextNode) {
          const currentTime = new Date(node.ts).getTime()
          const nextTime = new Date(nextNode.ts).getTime()
          duration = nextTime - currentTime
        } else if (task.end_time) {
          const currentTime = new Date(node.ts).getTime()
          const endTime = new Date(task.end_time).getTime()
          duration = endTime - currentTime
        } else {
          continue
        }

        if (duration < 0 || duration > 3600000) {
          continue
        }
        if (node.status === 'running') {
          continue
        }

        if (!statsMap.has(node.name)) {
          statsMap.set(node.name, {
            durations: [],
            successCount: 0,
            failCount: 0,
          })
        }

        const stats = statsMap.get(node.name)!
        stats.durations.push(duration)

        if (node.status === 'success') {
          stats.successCount++
        } else if (node.status === 'failed') {
          stats.failCount++
        }
      }
    }

    const result: NodeStatistics[] = []

    for (const [name, stats] of statsMap.entries()) {
      const durations = stats.durations
      const count = durations.length

      if (count === 0) continue

      const totalDuration = durations.reduce((sum, d) => sum + d, 0)
      const avgDuration = totalDuration / count
      const minDuration = Math.min(...durations)
      const maxDuration = Math.max(...durations)
      const settledCount = stats.successCount + stats.failCount
      const successRate = settledCount > 0 ? (stats.successCount / settledCount) * 100 : 0

      result.push({
        name,
        count,
        totalDuration,
        avgDuration,
        minDuration,
        maxDuration,
        successCount: stats.successCount,
        failCount: stats.failCount,
        successRate,
        durations,
      })
    }

    result.sort((a, b) => b.avgDuration - a.avgDuration)
    return result
  }

  static getTopSlowest(tasks: TaskInfo[], topN = 10): NodeStatistics[] {
    const allStats = this.analyze(tasks)
    return allStats.slice(0, topN)
  }

  static getTopFrequent(tasks: TaskInfo[], topN = 10): NodeStatistics[] {
    const allStats = this.analyze(tasks)
    return [...allStats].sort((a, b) => b.count - a.count).slice(0, topN)
  }

  static getTopFailed(tasks: TaskInfo[], topN = 10): NodeStatistics[] {
    const allStats = this.analyze(tasks)
    return [...allStats]
      .filter((s) => s.failCount > 0)
      .sort((a, b) => (b.failCount / b.count) - (a.failCount / a.count))
      .slice(0, topN)
  }

  static analyzeRecognitionAction(tasks: TaskInfo[]): RecognitionActionStatistics[] {
    const statsMap = new Map<string, {
      recognitionDurations: number[]
      actionDurations: number[]
      recognitionAttempts: number[]
      successCount: number
      failCount: number
    }>()

    for (const task of tasks) {
      const nodes = task.nodes

      for (const node of nodes) {
        const attempts = buildNodeRecognitionAttempts(node)
        if (attempts.length === 0) continue

        if (!statsMap.has(node.name)) {
          statsMap.set(node.name, {
            recognitionDurations: [],
            actionDurations: [],
            recognitionAttempts: [],
            successCount: 0,
            failCount: 0,
          })
        }

        const stats = statsMap.get(node.name)!
        stats.recognitionAttempts.push(attempts.length)

        if (attempts.length > 0) {
          const firstAttemptTs = new Date(attempts[0].ts).getTime()
          const lastAttempt = attempts[attempts.length - 1]
          const lastAttemptTime = new Date(lastAttempt.end_ts || lastAttempt.ts).getTime()
          const recognitionDuration = lastAttemptTime - firstAttemptTs

          if (attempts.length > 1 && recognitionDuration >= 0 && recognitionDuration < 3600000) {
            stats.recognitionDurations.push(recognitionDuration)
          }

          const nodeCompleteTime = new Date(node.end_ts || node.ts).getTime()
          const actionDuration = nodeCompleteTime - lastAttemptTime

          if (actionDuration >= 0 && actionDuration < 3600000) {
            stats.actionDurations.push(actionDuration)
          }
        }

        if (node.status === 'success') {
          stats.successCount++
        } else if (node.status === 'failed') {
          stats.failCount++
        }
      }
    }

    const result: RecognitionActionStatistics[] = []

    for (const [name, stats] of statsMap.entries()) {
      const count = stats.successCount + stats.failCount
      if (count === 0) continue

      const recognitionDurations = stats.recognitionDurations
      const recognitionCount = recognitionDurations.length
      const totalRecognitionDuration = recognitionDurations.reduce((sum, d) => sum + d, 0)
      const avgRecognitionDuration = recognitionCount > 0 ? totalRecognitionDuration / recognitionCount : 0
      const minRecognitionDuration = recognitionCount > 0 ? Math.min(...recognitionDurations) : 0
      const maxRecognitionDuration = recognitionCount > 0 ? Math.max(...recognitionDurations) : 0

      const actionDurations = stats.actionDurations
      const actionCount = actionDurations.length
      const totalActionDuration = actionDurations.reduce((sum, d) => sum + d, 0)
      const avgActionDuration = actionCount > 0 ? totalActionDuration / actionCount : 0
      const minActionDuration = actionCount > 0 ? Math.min(...actionDurations) : 0
      const maxActionDuration = actionCount > 0 ? Math.max(...actionDurations) : 0

      const totalRecognitionAttempts = stats.recognitionAttempts.reduce((sum, a) => sum + a, 0)
      const avgRecognitionAttempts = totalRecognitionAttempts / stats.recognitionAttempts.length

      const successRate = (stats.successCount / count) * 100

      result.push({
        name,
        count,
        avgRecognitionDuration,
        minRecognitionDuration,
        maxRecognitionDuration,
        totalRecognitionDuration,
        recognitionCount,
        avgActionDuration,
        minActionDuration,
        maxActionDuration,
        totalActionDuration,
        actionCount,
        avgRecognitionAttempts,
        totalRecognitionAttempts,
        successCount: stats.successCount,
        failCount: stats.failCount,
        successRate,
      })
    }

    result.sort((a, b) => b.avgActionDuration - a.avgActionDuration)
    return result
  }
}
