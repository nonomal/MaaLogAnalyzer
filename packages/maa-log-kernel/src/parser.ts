export interface ParseProgress {
  current: number
  total: number
  percentage: number
}

export interface ParseFileOptions {
  chunkLineCount?: number
  yieldControl?: (() => Promise<void> | void) | null
}
