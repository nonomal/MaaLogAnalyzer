# Maa Log Analyzer - VS Code 扩展

VS Code 扩展版本的 MAA 日志分析器。

## 构建步骤

### 1. 构建 Webview 资源

在项目根目录执行：

```bash
pnpm build:vscode
```

这会将 Vue 应用构建到 `src-vscode/webview/` 目录。

### 2. 构建扩展

```bash
cd src-vscode
npm install
npm run compile
```

### 3. 打包扩展

```bash
npm run package
```

这会生成 `.vsix` 文件，可以直接安装到 VS Code。

## 开发调试

1. 在 VS Code 中打开 `src-vscode` 目录
2. 按 `F5` 启动调试
3. 在调试窗口中运行命令 `MAA: 打开日志分析器`

## 功能

- 命令面板：`MAA: 打开日志分析器` - 打开分析器面板
- 右键菜单：在 `.log` 文件上右键选择 `MAA: 分析此日志文件`

## 目录结构

```
src-vscode/
├── package.json        # 扩展配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Webview 构建配置
├── .vscodeignore       # 打包忽略文件
├── src/
│   └── extension.ts    # 扩展入口
└── webview/            # 构建产物（Vue 应用）
```

## Windows 文件管理器右键菜单（文件夹）`r`n`r`n推荐直接在扩展里执行命令（无需手动跑脚本）：`r`n`r`n1. `Maa: 安装 Windows 右键菜单``r`n2. 在资源管理器中右键文件夹，点击“用 MAA Log Analyzer 分析”`r`n3. 如需移除，执行 `Maa: 卸载 Windows 右键菜单``r`n`r`n备用方式（手动脚本）：`r`n`r`n```powershell`r`npowershell -ExecutionPolicy Bypass -File .\scripts\windows\install-context-menu.ps1`r`n```