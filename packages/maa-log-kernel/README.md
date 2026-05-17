# @windsland52/maa-log-kernel

Contract-first kernel package for Maa log analysis.

## Responsibility

- Define stable output protocol and schema version
- Define reusable types for tasks/events/statistics
- Build standardized `KernelOutput` payloads

This package intentionally does **not** run parser logic directly.

## Exports

- `@windsland52/maa-log-kernel`
  - `buildKernelOutput`
  - `buildKernelWarnings`
  - `DEFAULT_KERNEL_PARSER_VERSION`
- `@windsland52/maa-log-kernel/protocol`
  - `KernelOutput`, `KernelStatistics`, `MLA_KERNEL_SCHEMA_VERSION`
- `@windsland52/maa-log-kernel/types`
  - `TaskInfo`, `NodeInfo`, `EventNotification`
- `@windsland52/maa-log-kernel/statistics`
  - `NodeStatistics`, `RecognitionActionStatistics`
- `@windsland52/maa-log-kernel/parser`
  - `ParseFileOptions`, `ParseProgress`

## Dependency policy

- Keep this package lightweight and contract-focused
- Avoid direct dependency on UI frameworks or platform APIs
