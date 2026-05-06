# @windsland52/maa-log-runtime

Runtime orchestration package for Maa log analysis.

## Responsibility

- Define execution adapter interface (`RuntimeExecutionAdapter`)
- Run analysis workflow through `analyzeLogContentWith`
- Produce `KernelOutput` via `@windsland52/maa-log-kernel`

This package does not own platform-specific input logic (zip/folder IO).

## Exports

- `analyzeLogContentWith(adapter, input)`
- `DEFAULT_CORE_PARSE_OPTIONS`
- `RuntimeExecutionAdapter`
- `AnalyzeLogContentInput`
- Re-exported kernel types (`KernelOutput`, `ParseFileOptions`)

## Usage pattern

1. Provide an adapter with:
   - `parse(input) => { tasks, events }`
   - `buildStatistics(tasks) => KernelStatistics`
2. Call `analyzeLogContentWith`.
3. In this repository, use `@windsland52/maa-log-adapter` as the concrete adapter.

## Dependency policy

- Depends on `@windsland52/maa-log-kernel` only
- Keep runtime generic and adapter-driven
