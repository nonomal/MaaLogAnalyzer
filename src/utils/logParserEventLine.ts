import type { EventNotification } from '../types'
import {
  buildEventDedupSignature,
  formatEventTimestampMs,
  parseEventTimestampMs,
} from './logParserEventMeta'

// 事件行正则：提取 timestamp, level, processId, threadId, msg, detailsJson
const EVENT_LINE_REGEX = /^\[([^\]]+)\]\[([^\]]+)\]\[(Px[^\]]+)\]\[(Tx[^\]]+)\].*!!!OnEventNotify!!!\s*\[handle=[^\]]*\]\s*\[msg=([^\]]+)\]\s*\[details=(.*)\]\s*$/

export type ParsedEventLine = EventNotification & {
  processId: string
  threadId: string
  _dedupSignature: string
  _timestampMs: number
}

interface ParseEventLineOptions {
  internEventToken: (raw: string) => string
  forceCopyString: (value: string) => string
}

export const parseEventLine = (
  line: string,
  lineNum: number,
  options: ParseEventLineOptions
): ParsedEventLine | null => {
  const match = line.match(EVENT_LINE_REGEX)
  if (!match) return null

  const [, rawTimestamp, rawLevel, rawProcessId, rawThreadId, rawMsg, detailsJson] = match
  const timestampMs = parseEventTimestampMs(rawTimestamp)
  const timestamp = Number.isFinite(timestampMs)
    ? formatEventTimestampMs(timestampMs)
    : options.forceCopyString(rawTimestamp)
  const level = options.internEventToken(rawLevel)
  const processId = options.internEventToken(rawProcessId)
  const threadId = options.internEventToken(rawThreadId)
  const msg = options.internEventToken(rawMsg)

  let details: Record<string, any> = {}
  try {
    details = JSON.parse(detailsJson)
  } catch {
    return null
  }

  return {
    timestamp,
    level,
    message: msg,
    details,
    processId,
    threadId,
    _lineNumber: lineNum,
    _dedupSignature: buildEventDedupSignature(msg, detailsJson),
    _timestampMs: timestampMs,
  }
}
