import type {
  EventNotification,
  KernelOutput,
  KernelStatistics,
  ParseFileOptions,
  TaskInfo,
} from '@windsland52/maa-log-kernel'
import {
  buildKernelOutput,
} from '@windsland52/maa-log-kernel'

export interface AnalyzeLogContentInput {
  content: string
  errorImages?: Map<string, string>
  visionImages?: Map<string, string>
  waitFreezesImages?: Map<string, string>
  parseOptions?: ParseFileOptions
  parserVersion?: string
}

export interface RuntimeParseInput {
  content: string
  errorImages?: Map<string, string>
  visionImages?: Map<string, string>
  waitFreezesImages?: Map<string, string>
  parseOptions?: ParseFileOptions
}

export interface RuntimeParseResult {
  tasks: TaskInfo[]
  events: EventNotification[]
}

export interface RuntimeExecutionAdapter {
  parse: (input: RuntimeParseInput) => Promise<RuntimeParseResult>
  buildStatistics: (tasks: TaskInfo[]) => KernelStatistics
}

export const DEFAULT_CORE_PARSE_OPTIONS: ParseFileOptions = {
  yieldControl: null,
}

export const analyzeLogContentWith = async (
  adapter: RuntimeExecutionAdapter,
  input: AnalyzeLogContentInput,
): Promise<KernelOutput> => {
  const parseResult = await adapter.parse({
    content: input.content,
    errorImages: input.errorImages,
    visionImages: input.visionImages,
    waitFreezesImages: input.waitFreezesImages,
    parseOptions: input.parseOptions ?? DEFAULT_CORE_PARSE_OPTIONS,
  })
  const stats = adapter.buildStatistics(parseResult.tasks)

  return buildKernelOutput({
    content: input.content,
    tasks: parseResult.tasks,
    events: parseResult.events,
    stats,
    parserVersion: input.parserVersion,
  })
}

export type { KernelOutput, ParseFileOptions, KernelStatistics } from '@windsland52/maa-log-kernel'
