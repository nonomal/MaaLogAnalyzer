# @windsland52/maa-log-adapter

Repository-specific runtime adapter package for MaaLogAnalyzer.

## Responsibility

- Bind `@windsland52/maa-log-runtime` adapter interface to current repository implementation
- Connect runtime parse flow to:
  - `@windsland52/maa-log-parser`
  - `@windsland52/maa-log-parser/node-statistics`

## Exports

- `createMlaRuntimeAdapter()`
- `mlaRuntimeAdapter`

## Notes

- This package is intentionally repository-coupled
- Keep generic runtime logic in `@windsland52/maa-log-runtime`
- Keep protocol/types in `@windsland52/maa-log-kernel`
