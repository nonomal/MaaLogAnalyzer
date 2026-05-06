import { getErrorMessage } from '../../../../utils/errorHandler'
import type { LoadedTextFile } from '../../../../utils/fileDialog'
import {
  createPrimaryLogParseInputs,
  type LoadedPrimaryLogFile,
} from '../../../../utils/logFileDiscovery'
import type { LogLoadingPipelineOptions } from './types'
import type { ProcessLogContentParams } from './types'
import type { TextSearchLoadedTarget } from '../useTextSearchTargets'

interface CreateUploadHandlersOptions {
  pipeline: LogLoadingPipelineOptions
  processLogContent: (params: ProcessLogContentParams) => Promise<void>
}

const createLoadedTargetsFromZip = (
  textFiles: Array<{ path: string; name: string; content: string }>,
): TextSearchLoadedTarget[] => {
  return textFiles.map((textFile, index) => ({
    id: `zip:${index}:${textFile.path}`,
    label: textFile.path,
    fileName: textFile.name,
    content: textFile.content,
  }))
}

const createLoadedTargetsFromTextFiles = (
  content: string,
  textFiles?: LoadedTextFile[],
  primaryLogFiles?: LoadedPrimaryLogFile[],
): TextSearchLoadedTarget[] => {
  const primaryPaths = new Set((primaryLogFiles ?? []).map(file => file.path))
  const primaryTargets: TextSearchLoadedTarget[] = (primaryLogFiles ?? []).map((file, index) => ({
    id: `loaded:primary:${index}:${file.path}`,
    label: file.path || file.name,
    fileName: file.name,
    content: file.content,
  }))
  const explicitTargets: TextSearchLoadedTarget[] = (textFiles ?? [])
    .filter(file => !primaryPaths.has(file.path))
    .map((file, index) => ({
      id: `loaded:text:${index}:${file.path}`,
      label: file.path || file.name,
      fileName: file.name,
      content: file.content,
    }))
  if (primaryTargets.length > 0) return [...primaryTargets, ...explicitTargets]
  if (explicitTargets.length > 0) return explicitTargets
  return [{ id: 'loaded:content', label: 'loaded.log', fileName: 'loaded.log', content }]
}

export const createLogLoadingUploadHandlers = (options: CreateUploadHandlersOptions) => {
  const { pipeline, processLogContent } = options

  const handleFileUpload = async (file: File) => {
    pipeline.loading.value = true
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const { extractZipContent } = await import('../../../../utils/zipExtractor')
        const result = await extractZipContent(file)
        if (!result) {
          pipeline.onWarning('ZIP 文件中未找到有效的日志文件')
          return
        }

        const loadedTargets = createLoadedTargetsFromZip(result.textFiles)
        const defaultTargetId = pipeline.pickPreferredLogTargetId(loadedTargets)
        await processLogContent({
          content: result.content,
          errorImages: result.errorImages,
          visionImages: result.visionImages,
          waitFreezesImages: result.waitFreezesImages,
          loadedTargets,
          loadedDefaultTargetId: defaultTargetId,
        })
        return
      }

      const content = await file.text()
      await processLogContent({
        content,
        loadedDefaultTargetId: 'loaded:single',
        deferredTargets: [{
          id: 'loaded:single',
          label: file.name,
          fileName: file.name,
          loadContent: async () => await file.text(),
        }],
      })
    } catch (error) {
      pipeline.onError(getErrorMessage(error))
    } finally {
      pipeline.loading.value = false
    }
  }

  const handleContentUpload = async (
    content: string,
    errorImages?: Map<string, string>,
    visionImages?: Map<string, string>,
    waitFreezesImages?: Map<string, string>,
    textFiles?: LoadedTextFile[],
    primaryLogFiles?: LoadedPrimaryLogFile[],
  ) => {
    pipeline.loading.value = true
    try {
      const loadedTargets = createLoadedTargetsFromTextFiles(content, textFiles, primaryLogFiles)
      const defaultTargetId = pipeline.pickPreferredLogTargetId(loadedTargets)
      await processLogContent({
        content,
        parseInputs: primaryLogFiles && primaryLogFiles.length > 0
          ? createPrimaryLogParseInputs(primaryLogFiles)
          : undefined,
        errorImages,
        visionImages,
        waitFreezesImages,
        loadedTargets,
        loadedDefaultTargetId: defaultTargetId,
      })
    } catch (error) {
      pipeline.onError(getErrorMessage(error))
    } finally {
      pipeline.loading.value = false
    }
  }

  return {
    handleFileUpload,
    handleContentUpload,
  }
}
