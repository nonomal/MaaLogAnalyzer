# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, GitHub Copilot, Cursor, etc.) when working with code in this repository.

## Project Overview

MaaLogAnalyzer is a Vue 3 + TypeScript + Tauri application for visualizing and analyzing logs from MaaFramework applications (v5.3+). It parses `maa.log` files to extract task execution flows, node details, and recognition/action attempts.

## Development Commands

```bash
# Install dependencies
pnpm install

# Web development (opens http://localhost:5173)
pnpm dev

# Build web version
pnpm build

# Tauri desktop development
pnpm tauri:dev

# Build Tauri desktop app
pnpm tauri:build

# Bump version (updates package.json and tauri.conf.json)
pnpm version
```

## Architecture

### Log Parsing Flow

1. **File Upload** → `App.vue` handles file input
2. **Chunked Parsing** → `LogParser.parseFile()` processes logs in 1000-line chunks asynchronously
3. **Event Extraction** → Extracts `!!!OnEventNotify!!!` events with IPC deduplication
4. **Task Construction** → `getTasks()` builds task hierarchy from events
5. **Node Extraction** → `getTaskNodes()` creates node tree with recognition attempts

### Core Data Structures

- **LogLine**: Raw parsed log line with timestamp, level, process/thread IDs, message, params
- **EventNotification**: Extracted event (e.g., `Tasker.Task.Starting`, `Node.PipelineNode.Succeeded`)
- **TaskInfo**: Task with entry point, status, nodes array, duration
- **NodeInfo**: Pipeline node with recognition attempts, action details, next_list, nested nodes
- **RecognitionAttempt**: Recognition try (success/failed) with reco_details and nested_nodes

### Key Components

- **LogParser** (`src/utils/logParser.ts`): Core parsing engine with string pooling and IPC deduplication
- **StringPool** (`src/utils/stringPool.ts`): Memory optimization via string interning
- **App.vue**: Main orchestrator with view modes (analysis/search/statistics/split)
- **ProcessView**: Task list and node flow visualization with virtual scrolling
- **DetailView**: Node details panel showing recognition/action information
- **TextSearchView**: Full-text search with streaming for large files

## Important Patterns

### String Pooling
The parser uses `StringPool` to deduplicate repeated strings (node names, timestamps) across thousands of nodes, reducing memory by ~80%.

### IPC Event Deduplication
MaaFramework logs contain duplicate events from IPC communication. The parser generates unique keys (`generateEventKey()`) based on timestamp + message + IDs to filter duplicates.

### Task Matching
- Tasks are matched by `uuid` (preferred) or `task_id` + FIFO order
- System task `MaaTaskerPostStop` is filtered out
- Running tasks calculate duration from last node timestamp

### Nested Node Handling
Recognition and action nodes can spawn sub-tasks with their own `task_id`. The parser tracks these separately and attaches them as `nested_nodes`, `nested_action_nodes`, or `nested_recognition_in_action`.

### Virtual Scrolling
Uses `vue-virtual-scroller` to render only visible nodes, supporting logs with thousands of nodes without DOM bloat.

## Performance Considerations

- **Chunked Parsing**: Processes 1000 lines per chunk with `setTimeout(0)` to keep UI responsive
- **Memory Management**: String pooling, event array clearing after task extraction, markRaw() for large objects
- **File Size Handling**:
  - Small files (<5MB): Direct load
  - Large files (≥5MB): Streaming load
  - Virtual scrolling for any size

## Log Format

Expects MaaFramework v5.3+ format:
```
[timestamp][level][processId][threadId][sourceFile][lineNumber][functionName] message [params] | status,duration
```

Event notifications contain `!!!OnEventNotify!!!` with `msg` and `details` parameters.

## Tauri Integration

- File dialogs use `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`
- Desktop app configured in `src-tauri/tauri.conf.json`
- Window size: 1400x900 (min 800x600)
