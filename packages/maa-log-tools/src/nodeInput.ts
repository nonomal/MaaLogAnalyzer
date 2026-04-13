import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync } from 'fflate'

const MAIN_LOG_NAMES = ['maa.log', 'maafw.log'] as const
const BAK_LOG_NAMES = ['maa.bak.log', 'maafw.bak.log'] as const
const SEARCH_TEXT_EXTENSIONS = ['.log', '.txt', '.jsonl'] as const

const PRIMARY_LOG_NAME_SET = new Set<string>([
  ...MAIN_LOG_NAMES,
  ...BAK_LOG_NAMES,
].map((name) => name.toLowerCase()))

export interface KernelTextFile {
  path: string
  name: string
  content: string
  reference: string
}

export interface NodeExtractedLogContent {
  content: string
  errorImages: Map<string, string>
  visionImages: Map<string, string>
  waitFreezesImages: Map<string, string>
  textFiles: KernelTextFile[]
}

const toPosixPath = (value: string): string => value.replace(/\\/g, '/')

const normalizeLowerPath = (value: string): string => toPosixPath(value).toLowerCase()

const isSearchTextFile = (normalizedPath: string): boolean => {
  const lower = normalizedPath.toLowerCase()
  return SEARCH_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const decodeNodeBytes = (bytes: Uint8Array): string => {
  const encodings = ['utf-8', 'gbk', 'gb18030', 'gb2312']
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true })
      const text = decoder.decode(bytes)
      const replacementCount = (text.match(/�/g) || []).length
      if (replacementCount < text.length * 0.01) {
        return text
      }
    } catch {
      continue
    }
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

const joinPath = (base: string, name: string): string => (base ? `${base}/${name}` : name)

const findBaseDirectory = (paths: string[]): string | null => {
  for (const p of paths) {
    const lower = normalizeLowerPath(p)
    if (
      lower.endsWith('/maa.log') ||
      lower === 'maa.log' ||
      lower.endsWith('/maafw.log') ||
      lower === 'maafw.log'
    ) {
      const normalized = toPosixPath(p)
      const lastSlash = normalized.lastIndexOf('/')
      return lastSlash === -1 ? '' : normalized.slice(0, lastSlash)
    }
  }
  return null
}

const findZipEntry = (
  entries: Record<string, Uint8Array>,
  paths: string[],
  targetPath: string,
): Uint8Array | null => {
  const normalizedTarget = normalizeLowerPath(targetPath)
  for (const currentPath of paths) {
    if (normalizeLowerPath(currentPath) === normalizedTarget) {
      return entries[currentPath]
    }
  }
  return null
}

const parseErrorImageKey = (fileName: string): string | null => {
  const match = fileName.match(
    /^(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\.(\d{1,3})_(.+)\.png$/,
  )
  if (!match) return null
  const [, timestamp, ms, nodeName] = match
  const paddedMs = ms.padEnd(3, '0')
  return `${timestamp}.${paddedMs}_${nodeName}`
}

const parseVisionImageKey = (fileName: string): string | null => {
  const match = fileName.match(
    /^(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\.(\d{1,3})_(.+_\d{9,})\.jpg$/i,
  )
  if (!match) return null
  const [, timestamp, ms, rest] = match
  const paddedMs = ms.padEnd(3, '0')
  return `${timestamp}.${paddedMs}_${rest}`
}

const parseWaitFreezesKey = (fileName: string): string | null => {
  const match = fileName.match(
    /^(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\.(\d{1,3})_(.+_wait_freezes)\.jpg$/i,
  )
  if (!match) return null
  const [, timestamp, ms, rest] = match
  const paddedMs = ms.padEnd(3, '0')
  return `${timestamp}.${paddedMs}_${rest}`
}

const isNeededZipEntry = (entryPath: string): boolean => {
  const lower = normalizeLowerPath(entryPath)
  const name = lower.slice(lower.lastIndexOf('/') + 1)
  if (isSearchTextFile(lower)) return true
  if (MAIN_LOG_NAMES.includes(name as (typeof MAIN_LOG_NAMES)[number])) return true
  if (BAK_LOG_NAMES.includes(name as (typeof BAK_LOG_NAMES)[number])) return true
  if (lower.includes('/on_error/') && lower.endsWith('.png')) return true
  if (lower.includes('/vision/') && lower.endsWith('.jpg')) return true
  return false
}

const toZipReference = (sourceRef: string, entryPath: string): string => {
  return `zip:${sourceRef}#${toPosixPath(entryPath)}`
}

const toFileReference = (absolutePath: string): string => {
  return `file:${toPosixPath(absolutePath)}`
}

export const readNodeTextFileContent = async (filePath: string): Promise<string> => {
  const bytes = await readFile(filePath)
  return decodeNodeBytes(new Uint8Array(bytes))
}

export const extractZipContentFromNodeBuffer = (
  zipData: Uint8Array,
  sourceRef: string = 'memory.zip',
): NodeExtractedLogContent | null => {
  const files = unzipSync(zipData, {
    filter: (entry) => isNeededZipEntry(entry.name),
  })
  const paths = Object.keys(files)
  const basePath = findBaseDirectory(paths)
  if (basePath == null) return null

  const bakLogName = BAK_LOG_NAMES.find((name) => findZipEntry(files, paths, joinPath(basePath, name)))
  const mainLogName = MAIN_LOG_NAMES.find((name) => findZipEntry(files, paths, joinPath(basePath, name)))

  const bakData = bakLogName ? findZipEntry(files, paths, joinPath(basePath, bakLogName)) : null
  const mainData = mainLogName ? findZipEntry(files, paths, joinPath(basePath, mainLogName)) : null

  let content = ''
  if (bakData) {
    content += decodeNodeBytes(bakData)
  }
  if (mainData) {
    if (content && !content.endsWith('\n')) content += '\n'
    content += decodeNodeBytes(mainData)
  }
  if (!content) return null

  const errorImages = new Map<string, string>()
  const visionImages = new Map<string, string>()
  const waitFreezesImages = new Map<string, string>()
  const textFiles: KernelTextFile[] = []

  const onErrorPrefix = joinPath(basePath, 'on_error/').toLowerCase()
  const visionPrefix = joinPath(basePath, 'vision/').toLowerCase()

  for (const currentPath of paths) {
    const normalizedPath = toPosixPath(currentPath)
    const lowerPath = normalizedPath.toLowerCase()
    const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)

    if (lowerPath.startsWith(onErrorPrefix) && lowerPath.endsWith('.png')) {
      const key = parseErrorImageKey(fileName)
      if (key) {
        errorImages.set(key, toZipReference(sourceRef, normalizedPath))
      }
    }

    if (lowerPath.startsWith(visionPrefix) && lowerPath.endsWith('.jpg')) {
      const visionKey = parseVisionImageKey(fileName)
      if (visionKey) {
        visionImages.set(visionKey, toZipReference(sourceRef, normalizedPath))
      }
      const waitKey = parseWaitFreezesKey(fileName)
      if (waitKey) {
        waitFreezesImages.set(waitKey, toZipReference(sourceRef, normalizedPath))
      }
    }

    if (isSearchTextFile(normalizedPath)) {
      const fileData = files[currentPath]
      if (!fileData) continue
      textFiles.push({
        path: normalizedPath,
        name: fileName,
        content: decodeNodeBytes(fileData),
        reference: toZipReference(sourceRef, normalizedPath),
      })
    }
  }

  textFiles.sort((a, b) => a.path.localeCompare(b.path))
  return { content, errorImages, visionImages, waitFreezesImages, textFiles }
}

export const extractZipContentFromNodeFile = async (
  zipFilePath: string,
): Promise<NodeExtractedLogContent | null> => {
  const bytes = await readFile(zipFilePath)
  return extractZipContentFromNodeBuffer(new Uint8Array(bytes), zipFilePath)
}

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

const hasMainLogInDirectory = async (dirPath: string): Promise<boolean> => {
  for (const name of MAIN_LOG_NAMES) {
    if (await pathExists(path.join(dirPath, name))) {
      return true
    }
  }
  return false
}

const findDebugDirectoryRecursively = async (rootPath: string): Promise<string | null> => {
  const entries = await readdir(rootPath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const subDirPath = path.join(rootPath, entry.name)
    if (await hasMainLogInDirectory(subDirPath)) {
      return subDirPath
    }
    const nested = await findDebugDirectoryRecursively(subDirPath)
    if (nested) return nested
  }
  return null
}

const resolveDebugDirectory = async (inputPath: string): Promise<string | null> => {
  if (await hasMainLogInDirectory(inputPath)) {
    return inputPath
  }

  const directDebugPath = path.join(inputPath, 'debug')
  if (await hasMainLogInDirectory(directDebugPath)) {
    return directDebugPath
  }

  return findDebugDirectoryRecursively(inputPath)
}

const collectFilesRecursively = async (rootPath: string): Promise<string[]> => {
  const collected: string[] = []
  const entries = await readdir(rootPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(fullPath)
      collected.push(...nested)
      continue
    }
    collected.push(fullPath)
  }
  return collected
}

const pickPrimaryLogPath = async (
  debugPath: string,
  allFiles: string[],
  candidates: readonly string[],
): Promise<string | null> => {
  for (const name of candidates) {
    const directPath = path.join(debugPath, name)
    if (await pathExists(directPath)) {
      return directPath
    }
  }

  const normalizedCandidates = new Set(candidates.map((name) => name.toLowerCase()))
  for (const filePath of allFiles) {
    const fileName = path.basename(filePath).toLowerCase()
    if (normalizedCandidates.has(fileName)) {
      return filePath
    }
  }
  return null
}

export const loadNodeLogDirectory = async (
  inputDirectoryPath: string,
): Promise<NodeExtractedLogContent | null> => {
  const debugPath = await resolveDebugDirectory(inputDirectoryPath)
  if (!debugPath) return null

  const allFiles = await collectFilesRecursively(debugPath)
  const bakLogPath = await pickPrimaryLogPath(debugPath, allFiles, BAK_LOG_NAMES)
  const mainLogPath = await pickPrimaryLogPath(debugPath, allFiles, MAIN_LOG_NAMES)

  let content = ''
  if (bakLogPath) {
    content += await readNodeTextFileContent(bakLogPath)
  }
  if (mainLogPath) {
    if (content && !content.endsWith('\n')) content += '\n'
    content += await readNodeTextFileContent(mainLogPath)
  }
  if (!content) return null

  const errorImages = new Map<string, string>()
  const visionImages = new Map<string, string>()
  const waitFreezesImages = new Map<string, string>()
  const textFiles: KernelTextFile[] = []

  for (const absolutePath of allFiles) {
    const relativePath = toPosixPath(path.relative(debugPath, absolutePath))
    const lowerRelativePath = relativePath.toLowerCase()
    const fileName = path.basename(absolutePath)
    const lowerFileName = fileName.toLowerCase()

    if (lowerRelativePath.includes('/on_error/') && lowerRelativePath.endsWith('.png')) {
      const key = parseErrorImageKey(fileName)
      if (key) {
        errorImages.set(key, toFileReference(absolutePath))
      }
    }

    if (lowerRelativePath.includes('/vision/') && lowerRelativePath.endsWith('.jpg')) {
      const visionKey = parseVisionImageKey(fileName)
      if (visionKey) {
        visionImages.set(visionKey, toFileReference(absolutePath))
      }
      const waitKey = parseWaitFreezesKey(fileName)
      if (waitKey) {
        waitFreezesImages.set(waitKey, toFileReference(absolutePath))
      }
    }

    if (!isSearchTextFile(relativePath)) continue
    if (PRIMARY_LOG_NAME_SET.has(lowerFileName)) continue

    textFiles.push({
      path: relativePath,
      name: fileName,
      content: await readNodeTextFileContent(absolutePath),
      reference: toFileReference(absolutePath),
    })
  }

  textFiles.sort((a, b) => a.path.localeCompare(b.path))

  return {
    content,
    errorImages,
    visionImages,
    waitFreezesImages,
    textFiles,
  }
}
