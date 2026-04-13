import type { KernelStatistics, TaskInfo } from '@windsland52/maa-log-kernel'
import type {
  RuntimeExecutionAdapter,
  RuntimeParseInput,
  RuntimeParseResult,
} from '@windsland52/maa-log-runtime'
import { LogParser } from '@windsland52/maa-log-parser'
import { NodeStatisticsAnalyzer } from '@windsland52/maa-log-parser/node-statistics'
import type { TaskInfo as ParserTaskInfo } from '@windsland52/maa-log-parser/types'

export const createMlaRuntimeAdapter = (): RuntimeExecutionAdapter => {
  return {
    async parse(input: RuntimeParseInput): Promise<RuntimeParseResult> {
      const parser = new LogParser()
      parser.setErrorImages(input.errorImages ?? new Map())
      parser.setVisionImages(input.visionImages ?? new Map())
      parser.setWaitFreezesImages(input.waitFreezesImages ?? new Map())

      await parser.parseFile(
        input.content,
        undefined,
        input.parseOptions,
      )

      return {
        tasks: parser.getTasksSnapshot(),
        events: parser.getEventsSnapshot(),
      }
    },
    buildStatistics(tasks: TaskInfo[]): KernelStatistics {
      const sourceTasks = tasks as ParserTaskInfo[]
      return {
        nodes: NodeStatisticsAnalyzer.analyze(sourceTasks),
        recognitionActions: NodeStatisticsAnalyzer.analyzeRecognitionAction(sourceTasks),
      }
    },
  }
}

export const mlaRuntimeAdapter = createMlaRuntimeAdapter()
