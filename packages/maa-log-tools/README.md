# @windsland52/maa-log-tools

Node tools package for Maa log analysis.

## Responsibility

- Provide Node input adapters (zip/file/folder)
- Provide high-level helpers:
  - `analyzeZipBuffer`
  - `analyzeZipFile`
  - `analyzeDirectory`
- Provide CLI entry (`mla-log-tools`)

`analyzeLogContent` is delegated to `@windsland52/maa-log-runtime` with a local parser/statistics adapter.
The concrete adapter is provided by `@windsland52/maa-log-adapter`.

## Exports

- `@windsland52/maa-log-tools`
  - `analyzeLogContent`
  - `analyzeZipBuffer`
  - `analyzeZipFile`
  - `analyzeDirectory`
  - `DEFAULT_CORE_PARSE_OPTIONS`
- `@windsland52/maa-log-tools/node-input`
  - Node file/zip/folder extraction helpers
- `@windsland52/maa-log-tools/cli`
  - CLI entry module

## CLI

```bash
pnpm kernel:cli <path> [--pretty] [--no-events]
```

`<path>` can be a log file, a zip file, or a log directory.
