import { resolveDeferredTargets } from './deferredTargets'
import type { LogLoadingPipelineOptions, ProcessLogContentParams } from './types'

export const createProcessLogContent = (
  options: LogLoadingPipelineOptions,
) => async (params: ProcessLogContentParams) => {
  options.stopRealtimeSession()
  options.resetAnalysisState()

  options.setDeferredTextSearchTargets(
    resolveDeferredTargets(params.content, params.loadedTargets, params.deferredTargets),
    params.loadedDefaultTargetId,
  )

  options.showParsingModal.value = true
  options.parseProgress.value = 0

  try {
    options.resetParserDebugAssets(
      params.errorImages,
      params.visionImages,
      params.waitFreezesImages,
    )

    const onProgress = (progress: { percentage: number }) => {
      options.parseProgress.value = progress.percentage
    }

    if (params.parseInputs && params.parseInputs.length > 0) {
      await options.parser.parseInputs(params.parseInputs, onProgress)
    } else {
      await options.parser.parseFile(params.content, onProgress)
    }
    const parsedTasks = options.parser.consumeTasks()
    options.applyParsedTasks(parsedTasks, false)

    if (parsedTasks.length === 0) {
      options.onWarning('未能解析出有效的任务数据，请检查日志文件格式是否正确')
    }
  } finally {
    options.showParsingModal.value = false
    options.parseProgress.value = 0
  }
}
