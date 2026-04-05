import { convertFileSrc as tauriConvertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from './platform'

const URL_LIKE_PREFIX = /^(?:data:|blob:|https?:\/\/|asset:\/\/|tauri:\/\/|file:\/\/)/i

export const resolveImageSrcPath = (source: string): string => {
  const normalized = source.trim()
  if (!normalized) return normalized
  if (URL_LIKE_PREFIX.test(normalized)) return normalized
  if (!isTauri()) return normalized

  try {
    return tauriConvertFileSrc(normalized)
  } catch {
    return normalized
  }
}
