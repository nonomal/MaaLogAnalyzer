
<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { 
  NCard, 
  NInput, 
  NButton, 
  NFlex, 
  NText, 
  NEmpty,
  NList,
  NListItem,
  NTag,
  NCheckbox,
  NInputGroup,
  NCollapse,
  NCollapseItem,
  NSplit,
  NScrollbar,
  NIcon,
  NSpin,
  NVirtualList,
  NDivider,
  NSelect
} from 'naive-ui'
import { parseLogLine } from '../utils/logHighlighter'
import { SearchOutlined, FileTextOutlined, CloseOutlined } from '@vicons/antd'
import { useIsMobile } from '../composables/useIsMobile'

const { isMobile } = useIsMobile()

const TEXT_SEARCH_LAYOUT_STORAGE_KEY = 'maa-log-analyzer-text-search-layout'

const clampSplitSize = (value: unknown, min: number, max: number, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const loadTextSearchSplitSize = () => {
  try {
    const raw = localStorage.getItem(TEXT_SEARCH_LAYOUT_STORAGE_KEY)
    if (!raw) return 0.4
    const parsed = JSON.parse(raw) as { splitSize?: number }
    return clampSplitSize(parsed?.splitSize, 0.2, 0.8, 0.4)
  } catch {
    return 0.4
  }
}

const textSearchSplitSize = ref(loadTextSearchSplitSize())

watch(textSearchSplitSize, (size) => {
  try {
    localStorage.setItem(
      TEXT_SEARCH_LAYOUT_STORAGE_KEY,
      JSON.stringify({ splitSize: clampSplitSize(size, 0.2, 0.8, 0.4) })
    )
  } catch {
    // ignore write errors
  }
})
interface LoadedSearchTarget {
  id: string
  label: string
  fileName: string
  content: string
}

// Props
const props = withDefaults(defineProps<{
  isDark?: boolean
  loadedTargets?: LoadedSearchTarget[]
  loadedDefaultTargetId?: string
}>(), {
  isDark: true,
  loadedTargets: () => [],
  loadedDefaultTargetId: ''
})

type SourceMode = 'loaded' | 'manual'
const sourceMode = ref<SourceMode>('manual')
const selectedLoadedTargetId = ref('')

const sourceModeOptions = [
  { label: '已加载目标', value: 'loaded' },
  { label: '手动选择文件', value: 'manual' }
]

const loadedTargetOptions = computed(() => {
  return (props.loadedTargets ?? []).map(target => ({
    label: target.label,
    value: target.id
  }))
})
const searchText = ref('')
const fileContent = ref('')  // 保留用于小文件（<5MB）
const fileName = ref('')
const fileSizeInMB = ref(0)  // 文件大小（MB）
const caseSensitive = ref(true)  // 默认区分大小写
const useRegex = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const maxResults = 500  // 固定最大结果数
const isSearching = ref(false)
const isLoadingFile = ref(false)  // 是否正在加载文件
const selectedLine = ref<number | null>(null)  // 当前选中的行
const searchHistory = ref<string[]>([])  // 搜索历史
const searchOptionExpandedNames = ref<Array<string | number>>(['search-options'])  // 搜索选项折叠状态
const mobileControlExpandedNames = ref<Array<string | number>>([])  // 手机端顶部控制折叠状态
const showFileContent = ref(false)  // 是否显示文件内容（默认关闭以节省内存）
const contentKey = ref(0)  // 用于强制重新渲染，释放内存
const hideDebugInfo = ref(true)  // 是否隐藏调试信息（如 [Px...][Tx...][...cpp]），默认隐藏
let abortSearch = false  // 中断搜索标志

// 新增：流式加载相关
const isLargeFile = ref(false)  // 是否是大文件（>5MB）
const fileHandle = ref<File | null>(null)  // 文件句柄（用于流式读取）
const totalLines = ref(0)  // 总行数
const contextLines = ref<string[]>([])  // 选中行的上下文（大文件模式）
const contextStartLine = ref(0)  // 上下文起始行号

// 搜索结果
interface SearchResult {
  lineNumber: number
  line: string
  matchStart: number
  matchEnd: number
  context: string
}

const searchResults = ref<SearchResult[]>([])
const totalMatches = ref(0)

const resetSearchResultsOnly = () => {
  abortSearch = true
  isSearching.value = false
  searchResults.value = []
  totalMatches.value = 0
  selectedLine.value = null
  contextLines.value = []
  contextStartLine.value = 0
}

const applyLoadedTarget = async (target: LoadedSearchTarget | undefined) => {
  if (!target) return
  isLoadingFile.value = true
  try {
    resetSearchResultsOnly()
    fileName.value = target.fileName || target.label
    fileContent.value = target.content ?? ''
    fileSizeInMB.value = new Blob([fileContent.value]).size / 1024 / 1024
    isLargeFile.value = false
    fileHandle.value = null
    totalLines.value = fileContent.value ? fileContent.value.split('\n').length : 0
    showFileContent.value = false
    contentKey.value += 1
  } finally {
    isLoadingFile.value = false
  }
}

const ensureLoadedTargetReady = async (): Promise<boolean> => {
  if (sourceMode.value !== 'loaded') {
    return Boolean(fileName.value && (fileContent.value || fileHandle.value))
  }

  const targets = props.loadedTargets ?? []
  if (targets.length === 0) return false

  const selectedExists = selectedLoadedTargetId.value
    ? targets.some(item => item.id === selectedLoadedTargetId.value)
    : false

  let targetId = selectedExists ? selectedLoadedTargetId.value : ''
  if (!targetId) {
    targetId = props.loadedDefaultTargetId && targets.some(item => item.id === props.loadedDefaultTargetId)
      ? props.loadedDefaultTargetId
      : targets[0].id
  }
  if (!targetId) return false

  if (selectedLoadedTargetId.value !== targetId) {
    selectedLoadedTargetId.value = targetId
  }

  const target = targets.find(item => item.id === targetId)
  if (!target) return false

  const expectedName = target.fileName || target.label
  const contentReady = Boolean(fileName.value && (fileContent.value || fileHandle.value))
  const sameTargetLoaded = fileName.value === expectedName
  if (!contentReady || !sameTargetLoaded) {
    await applyLoadedTarget(target)
  }

  return Boolean(fileName.value && (fileContent.value || fileHandle.value))
}

watch(
  () => [props.loadedTargets, props.loadedDefaultTargetId] as const,
  async ([targets, defaultId]) => {
    const safeTargets = targets ?? []
    if (safeTargets.length === 0) {
      if (sourceMode.value === 'loaded') {
        sourceMode.value = 'manual'
      }
      return
    }

    if (sourceMode.value === 'loaded' || !fileName.value) {
      sourceMode.value = 'loaded'
    }

    const preferredId = defaultId && safeTargets.some(item => item.id === defaultId)
      ? defaultId
      : safeTargets[0].id

    if (preferredId && selectedLoadedTargetId.value !== preferredId) {
      selectedLoadedTargetId.value = preferredId
      return
    }

    if (preferredId) {
      await applyLoadedTarget(safeTargets.find(item => item.id === preferredId))
    }
  },
  { immediate: true, deep: true }
)
watch(selectedLoadedTargetId, async (id) => {
  if (sourceMode.value !== 'loaded') return
  const target = (props.loadedTargets ?? []).find(item => item.id === id)
  await applyLoadedTarget(target)
})

watch(sourceMode, async (mode) => {
  if (mode !== 'loaded') return
  const targets = props.loadedTargets ?? []
  if (targets.length === 0) {
    sourceMode.value = 'manual'
    return
  }
  const nextId = selectedLoadedTargetId.value && targets.some(item => item.id === selectedLoadedTargetId.value)
    ? selectedLoadedTargetId.value
    : (props.loadedDefaultTargetId && targets.some(item => item.id === props.loadedDefaultTargetId)
      ? props.loadedDefaultTargetId
      : targets[0].id)
  if (!nextId) return
  if (selectedLoadedTargetId.value !== nextId) {
    selectedLoadedTargetId.value = nextId
  } else {
    await applyLoadedTarget(targets.find(item => item.id === nextId))
  }
})

// 快捷搜索选项
const quickSearchOptions = [
  'reco hit',
  'Version',
  '[ERR]',
  'display_width_='
]

// 调试信息正则：匹配 [Px数字][Tx数字][Lx数字][文件名.cpp] 等模式
const DEBUG_INFO_PATTERN = /\[P[xX]\d+\]|\[T[xX]\d+\]|\[L\d+\]|\[[^\]]+\.(cpp|h|hpp|c)\]/gi

// 过滤调试信息
const filterDebugInfo = (line: string): string => {
  if (!hideDebugInfo.value) return line
  return line.replace(DEBUG_INFO_PATTERN, '').replace(/\s{2,}/g, ' ').trim()
}



// 加载搜索历史
onMounted(() => {
  const saved = localStorage.getItem('searchHistory')
  if (saved) {
    try {
      searchHistory.value = JSON.parse(saved)
    } catch (e) {
      // 忽略解析错误
    }
  }
})

// 保存搜索历史
const saveSearchHistory = () => {
  try {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
  } catch (e) {
    // 忽略保存错误
  }
}

// 添加到搜索历史
const addToHistory = (text: string) => {
  if (!text || text.trim() === '') return
  
  // 移除已存在的相同项
  const index = searchHistory.value.indexOf(text)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
  }
  
  // 添加到开头
  searchHistory.value.unshift(text)
  
  // 限制历史记录数量（最多20条）
  if (searchHistory.value.length > 20) {
    searchHistory.value = searchHistory.value.slice(0, 20)
  }
  
  saveSearchHistory()
}

// 从历史中删除
const removeFromHistory = (text: string) => {
  const index = searchHistory.value.indexOf(text)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
    saveSearchHistory()
  }
}

// 使用历史记录
const useHistoryItem = (text: string) => {
  searchText.value = text
  performSearch()
}

// 执行搜索（支持流式搜索）
const performSearch = async () => {
  if (!searchText.value) {
    searchResults.value = []
    totalMatches.value = 0
    return
  }
  
  // 检查是否正在加载文件
  if (isLoadingFile.value) {
    return
  }

  // 检查是否有文件；loaded 模式下尝试自动补齐默认目标
  if (sourceMode.value === 'loaded') {
    const ready = await ensureLoadedTargetReady()
    if (!ready) {
      alert('请先选择已加载目标文件')
      return
    }
  } else if (!fileName.value || (!fileContent.value && !fileHandle.value)) {
    alert('请先选择文件')
    return
  }
  
  isSearching.value = true
  abortSearch = false
  
  try {
    if (isLargeFile.value && fileHandle.value) {
      // 大文件：流式搜索
      await performStreamSearch()
    } else {
      // 小文件：传统搜索
      await performNormalSearch()
    }
    
    if (searchText.value && !abortSearch) {
      addToHistory(searchText.value)
    }
  } catch (error) {
    alert('搜索失败: ' + error)
  } finally {
    isSearching.value = false
  }
}

// 传统搜索（小文件）
const performNormalSearch = async () => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      try {
        const lines = fileContent.value.split('\n')
        const results: SearchResult[] = []
        let searchPattern: RegExp | null = null
        
        // 编译正则表达式（如果使用）
        if (useRegex.value) {
          try {
            searchPattern = new RegExp(searchText.value, caseSensitive.value ? 'g' : 'gi')
          } catch (e) {
            resolve()
            return
          }
        }
        
        // 搜索
        for (let index = 0; index < lines.length; index++) {
          if (abortSearch || results.length >= maxResults) break
          
          const line = lines[index]
          const match = findMatchInLine(line, searchPattern)
          
          if (match) {
            results.push({
              lineNumber: index + 1,
              line: line,
              matchStart: match.start,
              matchEnd: match.end,
              context: line
            })
          }
        }
        
        searchResults.value = results
        totalMatches.value = results.length
      } finally {
        resolve()
      }
    }, 10)
  })
}

// 流式搜索（大文件）
const performStreamSearch = async () => {
  if (!fileHandle.value) return

  const results: SearchResult[] = []
  const reader = fileHandle.value.stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0
  let searchPattern: RegExp | null = null

  // 编译正则表达式
  if (useRegex.value) {
    try {
      searchPattern = new RegExp(searchText.value, caseSensitive.value ? 'g' : 'gi')
    } catch (e) {
      return
    }
  }

  try {
    while (true) {
      if (abortSearch) {
        break
      }
      
      const { done, value } = await reader.read()
      if (done) break
      
      // 解码数据
      buffer += decoder.decode(value, { stream: true })
      
      // 处理完整的行
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // 保留最后一个不完整的行
      
      // 搜索每一行
      for (const line of lines) {
        lineNumber++
        
        if (results.length >= maxResults) {
          reader.releaseLock()
          searchResults.value = results
          totalMatches.value = results.length
          return
        }
        
        const match = findMatchInLine(line, searchPattern)
        
        if (match) {
          results.push({
            lineNumber: lineNumber,
            line: line,
            matchStart: match.start,
            matchEnd: match.end,
            context: line
          })
        }
      }
    }
    
    // 处理最后一行
    if (buffer) {
      lineNumber++
      const match = findMatchInLine(buffer, searchPattern)
      if (match && results.length < maxResults) {
        results.push({
          lineNumber: lineNumber,
          line: buffer,
          matchStart: match.start,
          matchEnd: match.end,
          context: buffer
        })
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  searchResults.value = results
  totalMatches.value = results.length
}

// 在一行中查找匹配（统一逻辑）
const findMatchInLine = (line: string, searchPattern: RegExp | null): { start: number; end: number } | null => {
  let matchStart = -1
  let matchEnd = -1
  
  if (useRegex.value && searchPattern) {
    // 正则搜索
    const matchResult = line.match(searchPattern)
    if (matchResult && matchResult.index !== undefined) {
      matchStart = matchResult.index
      matchEnd = matchStart + matchResult[0].length
    }
  } else {
    // 普通文本搜索
    if (caseSensitive.value) {
      matchStart = line.indexOf(searchText.value)
      if (matchStart !== -1) {
        matchEnd = matchStart + searchText.value.length
      }
    } else {
      const lowerLine = line.toLowerCase()
      const lowerSearch = searchText.value.toLowerCase()
      matchStart = lowerLine.indexOf(lowerSearch)
      if (matchStart !== -1) {
        matchEnd = matchStart + searchText.value.length
      }
    }
  }
  
  return matchStart !== -1 ? { start: matchStart, end: matchEnd } : null
}

// 处理文件上传（智能加载策略）
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  sourceMode.value = 'manual'
  isLoadingFile.value = true
  
  try {
    fileName.value = file.name
    fileSizeInMB.value = file.size / 1024 / 1024

    // 策略选择
    if (fileSizeInMB.value < 5) {
      // 小文件：直接加载到内存
      isLargeFile.value = false
      fileContent.value = await file.text()
      totalLines.value = fileContent.value.split('\n').length
      fileHandle.value = null
    } else {
      // 大文件：流式加载模式
      isLargeFile.value = true
      fileContent.value = ''  // 不加载内容
      fileHandle.value = file

      // 快速统计行数（不加载全部内容）
      totalLines.value = await countLinesInFile(file)
    }
  } catch (error) {
    alert('文件读取失败: ' + error)
  } finally {
    isLoadingFile.value = false
  }
}

// 快速统计文件行数（不加载全部内容）
const countLinesInFile = async (file: File): Promise<number> => {
  let lineCount = 0
  const reader = file.stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      lineCount += lines.length - 1
      buffer = lines[lines.length - 1]  // 保留最后一行
    }
    
    if (buffer) lineCount++  // 最后一行
  } finally {
    reader.releaseLock()
  }
  
  return lineCount
}

// 高亮显示匹配文本
const highlightMatch = (result: SearchResult) => {
  const filteredLine = filterDebugInfo(result.line)
  // 如果过滤后内容变化，重新计算匹配位置
  if (hideDebugInfo.value && filteredLine !== result.line) {
    // 在过滤后的内容中重新查找匹配
    const matchText = result.line.substring(result.matchStart, result.matchEnd)
    const newMatchStart = filteredLine.indexOf(matchText)
    if (newMatchStart !== -1) {
      const before = filteredLine.substring(0, newMatchStart)
      const match = matchText
      const after = filteredLine.substring(newMatchStart + matchText.length)
      return { before, match, after }
    }
    // 匹配内容被过滤掉了，返回整行
    return { before: filteredLine, match: '', after: '' }
  }
  const before = result.line.substring(0, result.matchStart)
  const match = result.line.substring(result.matchStart, result.matchEnd)
  const after = result.line.substring(result.matchEnd)
  
  return { before, match, after }
}

// 清除内容（激进模式 + 流式支持）
const clearContent = () => {
  // 1. 立即中断所有操作
  abortSearch = true
  isSearching.value = false

  // 2. 强制卸载所有组件
  contentKey.value++

  // 3. 隐藏内容显示
  showFileContent.value = false
  selectedLine.value = null

  // 4. 清空所有数组和对象
  searchResults.value = []
  totalMatches.value = 0
  searchText.value = ''

  // 5. 清空流式加载相关
  isLargeFile.value = false
  fileHandle.value = null
  totalLines.value = 0
  fileSizeInMB.value = 0
  contextLines.value = []
  contextStartLine.value = 0

  // 6. 使用 nextTick 确保 Vue 完成更新
  nextTick(() => {
    // 清除文件内容
    fileContent.value = ''
    fileName.value = ''

    // 重置 file input
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }

    // 7. 尝试触发 GC
    if (typeof window !== 'undefined' && 'gc' in window) {
      ;(window as any).gc()
    }

    // 8. 最终确认
    nextTick(() => {
      // 内存清理完成
    })
  })
}

// 触发文件选择
const triggerFileSelect = () => {
  sourceMode.value = 'manual'
  fileInputRef.value?.click()
}

// 文件内容行数组（懒加载）
const fileLines = computed(() => {
  if (!fileContent.value) return []
  return fileContent.value.split('\n').map((line, index) => ({
    key: index,
    content: filterDebugInfo(line)
  }))
})

// 跳转到指定行
const jumpToLine = async (lineNumber: number) => {
  selectedLine.value = lineNumber

  // 大文件模式：读取上下文
  if (isLargeFile.value && fileHandle.value) {
    await loadContextLines(lineNumber)
    return
  }

  // 小文件模式：显示文件内容
  const needsInitialRender = !showFileContent.value

  if (needsInitialRender) {
    showFileContent.value = true
  }

  // 使用虚拟列表定位
  const itemSize = 22 // 与模板中的 :item-size="22" 保持一致
  const topOffset = 3 // 让目标行距离顶部偏移 3 行，这样更容易看到上下文

  const scrollToLine = () => {
    if (virtualListRef.value) {
      // 使用像素计算进行精确滚动
      // 目标：让选中行显示在距离顶部约 3 行的位置
      const targetIndex = Math.max(0, lineNumber - 1 - topOffset)
      const scrollTop = targetIndex * itemSize

      // 尝试找到内部的滚动容器并直接设置 scrollTop
      const scrollContainer = virtualListRef.value.$el?.querySelector('.v-vl') as HTMLElement | null
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop
      } else {
        // 回退：使用 scrollTo 方法
        try {
          virtualListRef.value.scrollTo({ index: targetIndex, behavior: 'auto' })
        } catch (e) {
          // 滚动失败
        }
      }
    }
  }

  if (needsInitialRender) {
    // 新渲染需要等待更长时间
    await nextTick()
    setTimeout(scrollToLine, 150)
  } else {
    nextTick(scrollToLine)
  }
}

const virtualListRef = ref<any>(null)


// 加载指定行的上下文（大文件模式）
const loadContextLines = async (targetLine: number) => {
  if (!fileHandle.value) return
  
  // 调整上下文范围：前面少一些，后面多一些，让目标行显示在顶部
  const beforeLines = 3   // 前面只显示3行
  const afterLines = 50   // 后面显示50行
  const startLine = Math.max(1, targetLine - beforeLines)
  const endLine = Math.min(totalLines.value, targetLine + afterLines)
  
  try {
    const reader = fileHandle.value.stream().getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentLine = 0
    const lines: string[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const splitLines = buffer.split('\n')
      buffer = splitLines.pop() || ''
      
      for (const line of splitLines) {
        currentLine++
        
        // 只收集目标范围内的行
        if (currentLine >= startLine && currentLine <= endLine) {
          lines.push(line)
        }
        
        // 超过范围就停止
        if (currentLine > endLine) {
          reader.releaseLock()
          contextLines.value = lines
          contextStartLine.value = startLine
          return
        }
      }
    }

    // 处理最后一行
    if (buffer && currentLine < endLine) {
      currentLine++
      if (currentLine >= startLine) {
        lines.push(buffer)
      }
    }

    reader.releaseLock()
    contextLines.value = lines
    contextStartLine.value = startLine

    // 由于目标行在前3行，默认就显示在顶部，不需要额外滚动
  } catch (error) {
    alert('加载上下文失败: ' + error)
  }
}

</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column" data-tour="textsearch-root" :class="{ 'dark-theme': props.isDark }">
    <!-- 顶部工具栏 -->
    <n-card
      size="small"
      data-tour="textsearch-toolbar"
      :bordered="false"
      content-style="padding: 12px 16px"
    >
      <!-- 移动端工具栏 -->
      <n-flex v-if="isMobile" vertical style="gap: 8px">
        <n-flex align="center" justify="space-between">
          <n-text strong style="font-size: 16px">文本搜索</n-text>
        </n-flex>
        <n-collapse v-model:expanded-names="mobileControlExpandedNames">
          <n-collapse-item title="已加载目标 / 选择文件 / 搜索选项" name="mobile-controls">
            <n-flex vertical style="gap: 8px">
              <input
                id="text-search-file-input"
                ref="fileInputRef"
                type="file"
                accept=".txt,.log"
                @change="handleFileUpload"
                style="display: none"
              />
              <n-flex align="center" style="gap: 8px; flex-wrap: wrap">
                <n-button size="small" type="primary" @click="triggerFileSelect">
                  <template #icon><file-text-outlined /></template>
                  选择其它文件
                </n-button>
                <n-button v-if="fileName" size="small" @click="clearContent" secondary type="warning">
                  <template #icon><n-icon><close-outlined /></n-icon></template>
                </n-button>
              </n-flex>
              <n-select
                v-model:value="sourceMode"
                :options="sourceModeOptions"
                size="small"
              />
              <n-select
                v-if="sourceMode === 'loaded'"
                v-model:value="selectedLoadedTargetId"
                :options="loadedTargetOptions"
                placeholder="选择已加载目标"
                size="small"
                :disabled="loadedTargetOptions.length === 0"
              />
              <n-flex align="center" style="gap: 8px; flex-wrap: wrap">
                <n-checkbox v-model:checked="caseSensitive" size="small">区分大小写</n-checkbox>
                <n-checkbox v-model:checked="useRegex" size="small">正则</n-checkbox>
                <n-checkbox v-model:checked="hideDebugInfo" size="small">隐藏调试</n-checkbox>
              </n-flex>
              <n-flex wrap style="gap: 6px">
                <n-button
                  v-for="option in quickSearchOptions"
                  :key="`m-quick-${option}`"
                  size="tiny"
                  secondary
                  @click="useHistoryItem(option)"
                  :type="searchText === option ? 'primary' : 'default'"
                >
                  {{ option }}
                </n-button>
              </n-flex>
              <n-flex v-if="searchHistory.length > 0" wrap style="gap: 6px">
                <n-tag
                  v-for="(item, idx) in searchHistory.slice(0, 8)"
                  :key="`m-history-${idx}`"
                  size="small"
                  closable
                  @close="removeFromHistory(item)"
                  @click="useHistoryItem(item)"
                  style="cursor: pointer"
                  :type="searchText === item ? 'primary' : 'default'"
                >
                  {{ item.length > 24 ? item.substring(0, 24) + '...' : item }}
                </n-tag>
              </n-flex>
            </n-flex>
          </n-collapse-item>
        </n-collapse>
        <n-flex v-if="fileName && !isLoadingFile" align="center" style="gap: 8px">
          <n-text depth="3" style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1">
            {{ fileName }}
          </n-text>
          <n-tag v-if="totalLines > 0" size="small" type="info">{{ totalLines }} 行</n-tag>
          <n-tag v-if="fileSizeInMB > 0" size="small" :type="isLargeFile ? 'error' : 'warning'">
            {{ fileSizeInMB.toFixed(1) }} MB
          </n-tag>
        </n-flex>
        <n-text v-if="isLoadingFile" type="info" style="font-size: 13px">正在加载文件...</n-text>
      </n-flex>
      <!-- 桌面端工具栏 -->
      <n-flex v-else align="center" justify="space-between" style="gap: 12px">
        <n-flex align="center" style="gap: 12px">
          <n-text strong style="font-size: 16px">📝 文本搜索</n-text>
          <n-select
            v-model:value="sourceMode"
            :options="sourceModeOptions"
            size="small"
            style="width: 140px"
          />
          <n-select
            v-if="sourceMode === 'loaded'"
            v-model:value="selectedLoadedTargetId"
            :options="loadedTargetOptions"
            placeholder="选择已加载目标"
            size="small"
            style="width: 320px"
            :disabled="loadedTargetOptions.length === 0"
          />
          <input
            id="text-search-file-input"
            ref="fileInputRef"
            type="file"
            accept=".txt,.log"
            @change="handleFileUpload"
            style="display: none"
          />
          <n-button
            size="small"
            type="primary"
            @click="triggerFileSelect"
          >
            <template #icon>
              <file-text-outlined />
            </template>
            选择其它文件
          </n-button>

          <n-button
            v-if="fileName"
            size="small"
            @click="clearContent"
            secondary
            type="warning"
          >
            <template #icon>
              <n-icon><close-outlined /></n-icon>
            </template>
            清除
          </n-button>
        </n-flex>

        <n-flex align="center" style="gap: 12px">
          <n-text v-if="isLoadingFile" type="info" style="font-size: 13px">
            ⏳ 正在加载文件...
          </n-text>
          <n-text v-else-if="fileName" depth="3" style="font-size: 13px">
            📄 {{ fileName }}
          </n-text>
          <n-tag v-if="totalLines > 0 && !isLoadingFile" size="small" type="info">
            {{ totalLines }} 行
          </n-tag>
          <n-tag v-if="fileSizeInMB > 0 && !isLoadingFile" size="small" :type="isLargeFile ? 'error' : 'warning'">
            {{ fileSizeInMB.toFixed(2) }} MB
            <span v-if="isLargeFile"> (流式模式)</span>
          </n-tag>
        </n-flex>
      </n-flex>
    </n-card>
    
    <!-- 主内容区域 -->
    <!-- 移动端：纯垂直布局，搜索+结果 -->
    <div v-if="isMobile" style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 8px; overflow: hidden">
      <!-- 搜索控制 -->
      <n-card size="small">
        <n-flex vertical style="gap: 10px">
          <n-input-group>
            <n-input
              v-model:value="searchText"
              placeholder="输入搜索内容..."
              clearable
              @keyup.enter="performSearch"
              :disabled="isSearching"
              :input-props="{ id: 'text-search-input-m', name: 'text-search-input-m' }"
            >
              <template #prefix>
                <search-outlined />
              </template>
            </n-input>
            <n-button
              type="primary"
              @click="performSearch"
              :loading="isSearching || isLoadingFile"
              :disabled="!searchText || !fileName || isLoadingFile"
            >
              搜索
            </n-button>
          </n-input-group>
          
        </n-flex>
      </n-card>

      <!-- 搜索结果 -->
      <n-card
        size="small"
        data-tour="textsearch-results"
        title="搜索结果"
        style="flex: 1; min-height: 0"
        content-style="height: 100%; overflow: hidden"
      >
        <template #header-extra>
          <n-text v-if="totalMatches > 0" type="success" style="font-size: 13px">
            {{ totalMatches }} 个结果
          </n-text>
        </template>

        <n-scrollbar style="height: 100%; padding-right: 4px">
          <n-empty v-if="!fileName" description="请先加载文件" />
          <n-empty v-else-if="isLoadingFile" description="文件加载中...">
            <template #icon><n-spin size="large" /></template>
          </n-empty>
          <n-empty v-else-if="!searchText" description="请输入搜索内容" />
          <n-empty v-else-if="isSearching" description="搜索中...">
            <template #icon><n-spin size="large" /></template>
          </n-empty>
          <n-empty v-else-if="searchResults.length === 0" description="未找到匹配结果" />
          <n-list v-else hoverable clickable>
            <n-list-item
              v-for="(result, idx) in searchResults"
              :key="idx"
              @click="jumpToLine(result.lineNumber)"
              style="cursor: pointer; padding: 6px 8px"
            >
              <n-flex align="center" style="gap: 6px">
                <n-tag size="small" :bordered="false">{{ result.lineNumber }}</n-tag>
                <n-text style="font-family: monospace; font-size: 12px; line-height: 1.5; word-break: break-all; flex: 1">
                  <span>{{ highlightMatch(result).before }}</span>
                  <span style="background-color: #f2c97d; color: #000; padding: 1px 3px; border-radius: 2px; font-weight: 600">
                    {{ highlightMatch(result).match }}
                  </span>
                  <span>{{ highlightMatch(result).after }}</span>
                </n-text>
              </n-flex>
            </n-list-item>
          </n-list>
        </n-scrollbar>
      </n-card>
    </div>

    <!-- 桌面端：NSplit 左右布局 -->
    <n-split
      v-else
      :key="contentKey"
      style="flex: 1; min-height: 0"
      v-model:size="textSearchSplitSize"
      :min="0.2"
      :max="0.8"
    >
      <!-- 左侧：搜索区域 -->
      <template #1>
        <div style="height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 12px">

          <!-- 搜索控制 -->
          <n-card size="small">
            <n-flex vertical style="gap: 12px">
              <n-input-group>
                <n-input
                  v-model:value="searchText"
                  placeholder="输入搜索内容..."
                  clearable
                  @keyup.enter="performSearch"
                  :disabled="isSearching"
                  :input-props="{ id: 'text-search-input', name: 'text-search-input' }"
                >
                  <template #prefix>
                    <search-outlined />
                  </template>
                </n-input>
                <n-button 
                  type="primary" 
                  @click="performSearch"
                  :loading="isSearching || isLoadingFile"
                  :disabled="!searchText || !fileName || isLoadingFile"
                >
                  {{ isLoadingFile ? '加载中...' : '搜索' }}
                </n-button>
              </n-input-group>
              
              <!-- 搜索选项 -->
              <n-collapse v-model:expanded-names="searchOptionExpandedNames">
                <n-collapse-item title="搜索选项" name="search-options">
                  <n-flex vertical style="gap: 10px">
                    <n-flex align="center" style="gap: 12px; flex-wrap: wrap">
                      <n-checkbox v-model:checked="caseSensitive">
                        区分大小写
                      </n-checkbox>
                      <n-checkbox v-model:checked="useRegex">
                        正则表达式
                      </n-checkbox>
                      <n-checkbox v-model:checked="hideDebugInfo">
                        隐藏调试标签
                      </n-checkbox>
                    </n-flex>

                    <div>
                      <n-text depth="3" style="font-size: 12px; margin-bottom: 6px; display: block">
                        快捷搜索：
                      </n-text>
                      <n-flex wrap style="gap: 6px">
                        <n-button
                          v-for="option in quickSearchOptions"
                          :key="option"
                          size="tiny"
                          secondary
                          @click="useHistoryItem(option)"
                          :type="searchText === option ? 'primary' : 'default'"
                        >
                          {{ option }}
                        </n-button>
                      </n-flex>
                    </div>

                    <div v-if="searchHistory.length > 0">
                      <n-text depth="3" style="font-size: 12px; margin-bottom: 6px; display: block">
                        搜索历史：
                      </n-text>
                      <n-flex wrap style="gap: 6px">
                        <n-tag
                          v-for="(item, idx) in searchHistory.slice(0, 10)"
                          :key="idx"
                          size="small"
                          closable
                          @close="removeFromHistory(item)"
                          @click="useHistoryItem(item)"
                          style="cursor: pointer"
                          :type="searchText === item ? 'primary' : 'default'"
                        >
                          {{ item.length > 30 ? item.substring(0, 30) + '...' : item }}
                        </n-tag>
                      </n-flex>
                    </div>
                  </n-flex>
                </n-collapse-item>
              </n-collapse>
            </n-flex>
          </n-card>

          <!-- 搜索结果 -->
          <n-card 
            size="small" 
            title="📋 搜索结果"
            style="flex: 1; min-height: 0"
            content-style="height: 100%; overflow: hidden"
          >
            <template #header-extra>
              <n-text v-if="totalMatches > 0" type="success" style="font-size: 13px">
                找到 {{ totalMatches }} 个结果
              </n-text>
            </template>
            
            <n-scrollbar style="height: 100%; padding-right: 8px">
              <n-empty 
                v-if="!fileName"
                description="请先加载文件"
              />
              
              <n-empty 
                v-else-if="isLoadingFile"
                description="文件加载中..."
              >
                <template #icon>
                  <n-spin size="large" />
                </template>
              </n-empty>
              
              <n-empty 
                v-else-if="!searchText"
                description="请输入搜索内容并点击搜索"
              />
              
              <n-empty 
                v-else-if="isSearching"
                description="搜索中..."
              >
                <template #icon>
                  <n-spin size="large" />
                </template>
              </n-empty>
              
              <n-empty 
                v-else-if="searchResults.length === 0"
                description="未找到匹配结果"
              />
              
              <n-list v-else hoverable clickable>
                <n-list-item 
                  v-for="(result, idx) in searchResults" 
                  :key="idx"
                  @click="jumpToLine(result.lineNumber)"
                  style="cursor: pointer; padding: 8px 12px"
                >
                  <n-text style="font-family: monospace; font-size: 12px; line-height: 1.6; word-break: break-all">
                    <span>{{ highlightMatch(result).before }}</span>
                    <span style="background-color: #f2c97d; color: #000; padding: 2px 4px; border-radius: 2px; font-weight: 600">
                      {{ highlightMatch(result).match }}
                    </span>
                    <span>{{ highlightMatch(result).after }}</span>
                  </n-text>
                </n-list-item>
              </n-list>
            </n-scrollbar>
          </n-card>
        </div>
      </template>
      
      <!-- 右侧：文件信息/搜索结果详情 -->
      <template #2>
        <n-card 
          data-tour="textsearch-content"
          :title="isLargeFile ? '📦 大文件信息' : '📄 文件内容'"
          size="small"
          style="height: 100%"
          content-style="height: 100%; overflow: hidden; padding: 0"
        >
          <template #header-extra>
            <n-button
              v-if="fileContent && !isLargeFile"
              size="tiny"
              :type="showFileContent ? 'primary' : 'default'"
              @click="showFileContent = !showFileContent"
            >
              {{ showFileContent ? '隐藏内容' : '显示内容' }}
            </n-button>
          </template>
          
          <div style="height: 100%; display: flex; flex-direction: column">
            <!-- 未加载文件 -->
            <div v-if="!fileName" style="padding: 40px 20px; text-align: center; flex: 1">
              <n-empty description="请先加载文件" />
            </div>
            
            <!-- 大文件模式 -->
            <div v-else-if="isLargeFile" style="height: 100%; display: flex; flex-direction: column">
              <!-- 有上下文：显示内容 -->
              <div v-if="contextLines.length > 0" style="flex: 1; overflow: hidden; display: flex; flex-direction: column">
                <div style="padding: 8px 12px; border-bottom: 1px solid var(--n-border-color)">
                  <n-flex align="center" justify="space-between">
                    <n-text depth="3" style="font-size: 12px">
                      显示行 {{ contextStartLine }} - {{ contextStartLine + contextLines.length - 1 }}
                      （共 {{ contextLines.length }} 行）
                    </n-text>
                    <n-text v-if="selectedLine" type="warning" style="font-size: 12px">
                      ▶ 第 {{ selectedLine }} 行
                    </n-text>
                  </n-flex>
                </div>
                <n-scrollbar x-scrollable style="flex: 1" content-style="width: max-content; min-width: 100%;">
                  <div :class="{ 'dark-theme': props.isDark }" style="padding: 12px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; width: max-content; min-width: 100%;">
                    <div 
                      v-for="(line, idx) in contextLines" 
                      :key="idx"
                      class="context-line"
                      :data-line="contextStartLine + idx"
                      :style="{
                        padding: '2px 8px',
                        backgroundColor: (contextStartLine + idx) === selectedLine ? 'var(--n-color-target)' : 'transparent',
                        borderRadius: '2px'
                      }"
                    >
                      <span style="color: var(--n-text-color-disabled); margin-right: 12px; user-select: none">
                        {{ String(contextStartLine + idx).padStart(6, ' ') }}
                      </span>
                      <span style="white-space: pre;">{{ filterDebugInfo(line) }}</span>
                    </div>
                  </div>
                </n-scrollbar>
              </div>
              
              <!-- 无上下文：显示提示 -->
              <div v-else style="padding: 40px 20px; text-align: center; flex: 1">
                <n-empty description="大文件流式模式">
                  <template #icon>
                    <n-icon size="48" color="#f2c97d">
                      <file-text-outlined />
                    </n-icon>
                  </template>
                  <template #extra>
                    <n-flex vertical style="gap: 12px; margin-top: 16px">
                      <n-text depth="2" style="font-size: 14px">
                        文件: {{ fileName }}
                      </n-text>
                      <n-text depth="3" style="font-size: 13px">
                        大小: {{ fileSizeInMB.toFixed(2) }} MB
                      </n-text>
                      <n-text depth="3" style="font-size: 13px">
                        行数: {{ totalLines }}
                      </n-text>
                      <n-divider style="margin: 8px 0" />
                      <n-text type="success" style="font-size: 13px">
                        ✅ 采用流式加载，内存占用极小
                      </n-text>
                      <n-text depth="3" style="font-size: 12px">
                        搜索时边读边搜，不保存完整文件
                      </n-text>
                      <n-text depth="3" style="font-size: 12px">
                        💡 点击左侧搜索结果查看上下文
                      </n-text>
                    </n-flex>
                  </template>
                </n-empty>
              </div>
            </div>
            
            <!-- 小文件：隐藏内容提示 -->
            <div v-else-if="!showFileContent" style="padding: 40px 20px; text-align: center; flex: 1">
              <n-empty description="点击右上角显示文件内容">
                <template #extra>
                  <n-text depth="3" style="font-size: 12px">
                    文件已加载 ({{ totalLines }} 行)，点击搜索结果会自动显示
                  </n-text>
                </template>
              </n-empty>
            </div>
            
            <!-- 小文件：虚拟列表显示 -->
            <div v-else style="flex: 1; height: 100%; overflow: hidden;">
              <n-virtual-list
                ref="virtualListRef"
                :items="fileLines"
                :item-size="22"
                style="height: 100%; max-height: 100%; overflow: auto;"
                :class="['log-virtual-list', { 'dark-theme': props.isDark }]"
              >
                <template #default="{ item, index }">
                  <div 
                    class="log-line"
                    :class="{ 'selected-line': (index + 1) === selectedLine }"
                    :data-line="index + 1"
                    @click="selectedLine = index + 1"
                  >
                    <span class="line-number">{{ index + 1 }}</span>
                    <span class="line-content">
                      <span 
                        v-for="(token, tIdx) in parseLogLine(item.content)" 
                        :key="tIdx"
                        :class="'token-' + token.type"
                      >{{ token.content }}</span>
                    </span>
                  </div>
                </template>
              </n-virtual-list>
            </div>
          </div>
        </n-card>
      </template>
    </n-split>
  </div>
</template>

<style scoped>
/* Fix Naive UI scrollbar container background in light mode */
:deep(.n-scrollbar-container) {
  background-color: transparent !important;
}

:deep(.n-scrollbar-content) {
  background-color: transparent !important;
}

:deep(.n-card__content) {
  background-color: transparent !important;
}

.log-virtual-list {
  /* Ensure the virtual list itself has a background for consistency */
  background-color: var(--n-color); 
}

.log-line {
  display: flex;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 22px;
  white-space: pre;
  cursor: text;
  padding-right: 12px; /* Add some padding to the right */
  width: max-content;
  min-width: 100%;
}

.log-line:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.selected-line {
  background-color: rgba(242, 201, 125, 0.2); /* var(--n-color-target) approx */
}

.line-number {
  display: inline-block;
  width: 50px;
  text-align: right;
  padding-right: 12px;
  color: var(--n-text-color-disabled);
  user-select: none;
  border-right: 1px solid var(--n-border-color);
  margin-right: 8px;
  background-color: #f5f5f5; /* Light mode background */
  flex-shrink: 0; /* Prevent line number from shrinking */
}

.line-content {
  flex: 1;
  white-space: nowrap; /* Keep line content on one line */
}

/* Syntax Highlighting Colors (VS Code Light Theme inspired) */
.token-timestamp {
  color: #098658; /* Green */
}

.token-level-info {
  color: #0000ff; /* Blue */
  font-weight: bold;
}

.token-level-warn {
  color: #795e26; /* Yellow/Brown */
  font-weight: bold;
}

.token-level-error {
  color: #cd3131; /* Red */
  font-weight: bold;
}

.token-level-debug {
  color: #800080; /* Purple */
}

.token-string {
  color: #a31515; /* Red/Brown */
}

.token-number {
  color: #098658; /* Green */
}

.token-key {
  color: #0451a5; /* Dark Blue */
}

.token-text {
  color: #333;
}

/* Dark mode adjustments using class instead of media query */
.dark-theme .log-line:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dark-theme .line-number {
  color: #666;
  border-right-color: #333;
  background-color: #1e1e1e;
}

.dark-theme .token-timestamp { color: #b5cea8; }
.dark-theme .token-level-info { color: #569cd6; }
.dark-theme .token-level-warn { color: #dcdcaa; }
.dark-theme .token-level-error { color: #f44747; }
.dark-theme .token-level-debug { color: #d16969; }
.dark-theme .token-string { color: #ce9178; }
.dark-theme .token-number { color: #b5cea8; }
.dark-theme .token-key { color: #9cdcfe; }
.dark-theme .token-text { color: #ffffffa2; }

/* Also apply to context lines in large file mode */
.dark-theme .context-line span:last-child {
  color: #ffffffa2;
}

/* Force horizontal scroll for virtual list */
.log-virtual-list :deep(.v-vl) {
  overflow: auto !important;
  scrollbar-width: auto !important; /* Override Naive UI's scrollbar-width: none */
}

.log-virtual-list :deep(.v-vl-items) {
  min-width: 100%;
  width: max-content !important;
}

.log-virtual-list :deep(.v-vl-item) {
  width: max-content !important;
  min-width: 100%;
}

/* Custom scrollbar styles for virtual list */
.log-virtual-list :deep(.v-vl)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.log-virtual-list :deep(.v-vl)::-webkit-scrollbar-track {
  background: transparent;
}

.log-virtual-list :deep(.v-vl)::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
}

.log-virtual-list :deep(.v-vl)::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.4);
}

/* Dark mode scrollbar */
.dark-theme :deep(.v-vl)::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
}

.dark-theme :deep(.v-vl)::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

/* Ensure scrollbar corner is styled */
.log-virtual-list :deep(.v-vl)::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
